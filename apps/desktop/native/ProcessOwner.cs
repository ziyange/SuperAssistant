using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

// Test-gated native process ownership; this is not a filesystem or network sandbox.
internal static class ProcessOwner
{
    private const uint CreateSuspended = 0x00000004;
    private const uint CreateNoWindow = 0x08000000;
    private const uint ExtendedStartupInfoPresent = 0x00080000;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint KillOnJobClose = 0x00002000;
    private const int MaximumLine = 65536;
    private const int MaximumChunk = 12288;
    private sealed class OutputFrame
    {
        public string Line;
        public ManualResetEventSlim Written;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes
    {
        public int length;
        public IntPtr descriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool inherit;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimit
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimit
    {
        public BasicLimit BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Accounting
    {
        public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public uint cb;
        public string reserved, desktop, title;
        public uint x, y, xSize, ySize, xCountChars, yCountChars, fillAttribute, flags;
        public ushort showWindow, reserved2;
        public IntPtr reservedPtr, stdInput, stdOutput, stdError;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr process, thread;
        public uint processId, threadId;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx
    {
        public StartupInfo startup;
        public IntPtr attributes;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimit info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out Accounting info, uint length, IntPtr returnLength);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value,
        IntPtr size, IntPtr previousValue, IntPtr returnSize);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(string executable, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes,
        bool inheritHandles, uint flags, IntPtr environment, string directory, ref StartupInfoEx startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SecurityAttributes attributes, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    private static void PumpOutput(FileStream pipe, string stream, Func<string, bool> emit, Action fail)
    {
        byte[] buffer = new byte[MaximumChunk];
        try
        {
            int count;
            while ((count = pipe.Read(buffer, 0, buffer.Length)) > 0)
                if (!emit("{\"type\":\"output\",\"stream\":\"" + stream + "\",\"data\":\"" + Convert.ToBase64String(buffer, 0, count) + "\"}"))
                    throw new IOException();
        }
        catch { fail(); }
        finally { Array.Clear(buffer, 0, buffer.Length); pipe.Dispose(); }
    }

    private static string ReadBoundedLine()
    {
        StringBuilder line = new StringBuilder();
        while (line.Length <= MaximumLine)
        {
            int next = Console.In.Read();
            if (next < 0) return null;
            if (next == '\n') return line.ToString();
            if (next == '\r' || next == 0) throw new InvalidDataException();
            line.Append((char)next);
        }
        throw new InvalidDataException();
    }

    // Implements the CommandLineToArgvW backslash/quote convention without a shell.
    private static string Quote(string value)
    {
        if (value == null || value.IndexOf('\0') >= 0) throw new InvalidDataException();
        StringBuilder output = new StringBuilder("\"");
        int slashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\') { slashes++; continue; }
            if (ch == '"') { output.Append('\\', slashes * 2 + 1); output.Append('"'); slashes = 0; continue; }
            output.Append('\\', slashes); slashes = 0; output.Append(ch);
        }
        output.Append('\\', slashes * 2);
        output.Append('"');
        return output.ToString();
    }

    private static Dictionary<string, object> Parse(string line)
    {
        if (line == null || line.Length == 0 || line.Length > MaximumLine) throw new InvalidDataException();
        JavaScriptSerializer serializer = new JavaScriptSerializer();
        serializer.MaxJsonLength = MaximumLine;
        Dictionary<string, object> request = serializer.DeserializeObject(line) as Dictionary<string, object>;
        if (request == null) throw new InvalidDataException();
        HashSet<string> keys = new HashSet<string>(StringComparer.Ordinal);
        int depth = 0;
        for (int index = 0; index < line.Length; index++)
        {
            char current = line[index];
            if (current == '{') { depth++; continue; }
            if (current == '}') { depth--; continue; }
            if (current != '"')
            {
                // The protocol admits only string values, string arrays and JSON punctuation.
                // JavaScriptSerializer is otherwise permissive about unquoted and single-quoted keys.
                if (current == '[' || current == ']' || current == ':' || current == ',' || current == ' ' || current == '\t') continue;
                throw new InvalidDataException();
            }
            int begin = index++;
            while (index < line.Length && line[index] != '"')
            {
                if (line[index] == '\\') index++;
                index++;
            }
            if (index >= line.Length) throw new InvalidDataException();
            int next = index + 1;
            while (next < line.Length && Char.IsWhiteSpace(line[next])) next++;
            if (depth == 1 && next < line.Length && line[next] == ':')
            {
                string key = serializer.Deserialize<string>(line.Substring(begin, index - begin + 1));
                if (key == null || !keys.Add(key)) throw new InvalidDataException();
            }
        }
        return request;
    }

    private static uint Active(IntPtr job)
    {
        Accounting value;
        if (!QueryInformationJobObject(job, 1, out value, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero))
            throw new InvalidOperationException();
        return value.ActiveProcesses;
    }

    private static bool IsAbsoluteLocalPath(string value)
    {
        return !String.IsNullOrEmpty(value) && value.Length >= 3 && Char.IsLetter(value[0]) && value[1] == ':'
            && (value[2] == '\\' || value[2] == '/') && Path.IsPathRooted(value);
    }

    private static IntPtr MinimalEnvironment()
    {
        SortedDictionary<string, string> variables = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (string name in new string[] { "SystemRoot", "WINDIR", "TEMP", "TMP" })
        {
            string value = Environment.GetEnvironmentVariable(name);
            if (!String.IsNullOrEmpty(value)) variables[name] = value;
        }
        if (!variables.ContainsKey("SystemRoot")) throw new InvalidOperationException();
        StringBuilder block = new StringBuilder();
        foreach (KeyValuePair<string, string> variable in variables)
            block.Append(variable.Key).Append('=').Append(variable.Value).Append('\0');
        block.Append('\0');
        return Marshal.StringToHGlobalUni(block.ToString());
    }

    private static int Main(string[] args)
    {
        IntPtr job = IntPtr.Zero;
        IntPtr attributes = IntPtr.Zero, jobList = IntPtr.Zero, environment = IntPtr.Zero;
        IntPtr inherited = IntPtr.Zero;
        IntPtr childInput = IntPtr.Zero, parentInput = IntPtr.Zero, parentOutput = IntPtr.Zero, childOutput = IntPtr.Zero;
        IntPtr parentError = IntPtr.Zero, childError = IntPtr.Zero;
        FileStream input = null, output = null, error = null;
        BlockingCollection<byte[]> inputQueue = null;
        BlockingCollection<OutputFrame> outputQueue = null;
        BlockingCollection<string> controlQueue = null;
        Thread inputThread = null, outputThread = null, errorThread = null;
        Thread outputWriter = null, controlReader = null;
        int inputFailed = 0, outputFailed = 0, controlFailed = 0;
        object jobLock = new object();
        Action terminateOwnedJob = () => { lock (jobLock) { if (job != IntPtr.Zero) TerminateJobObject(job, 1); } };
        bool attributesInitialized = false;
        ProcessInformation child = new ProcessInformation();
        bool assigned = false;
        try
        {
            string firstLine;
#if SA_OWNER_TEST
            bool checkpoint = args.Length == 3 && args[0] == "--test-start";
            bool failClose = args.Length == 1 && args[0] == "--test-fail-close";
            bool failJobAttribute = args.Length == 1 && args[0] == "--test-fail-job-attribute";
            bool failInput = args.Length == 1 && args[0] == "--test-fail-input";
            bool controlRace = args.Length == 4 && args[0] == "--test-control-race";
            firstLine = checkpoint ? File.ReadAllText(args[1]) : ReadBoundedLine();
#else
            if (args.Length != 0) throw new InvalidDataException();
            firstLine = ReadBoundedLine();
#endif
            Dictionary<string, object> start = Parse(firstLine);
            object type, executableValue, cwdValue, argumentsValue;
            if (start.Count != 4 || !start.TryGetValue("type", out type) || !Object.Equals(type, "start")
                || !start.TryGetValue("executable", out executableValue) || !start.TryGetValue("cwd", out cwdValue)
                || !start.TryGetValue("args", out argumentsValue)) throw new InvalidDataException();
            string executable = executableValue as string, cwd = cwdValue as string;
            object[] arguments = argumentsValue as object[];
            if (!IsAbsoluteLocalPath(executable) || !IsAbsoluteLocalPath(cwd) || !File.Exists(executable) || !Directory.Exists(cwd)
                || arguments == null || arguments.Length > 64) throw new InvalidDataException();
            StringBuilder command = new StringBuilder(Quote(executable));
            foreach (object argument in arguments)
            {
                string value = argument as string;
                if (value == null || value.Length > 8192) throw new InvalidDataException();
                command.Append(' ').Append(Quote(value));
            }
            if (command.Length > 32767) throw new InvalidDataException();
            job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw new InvalidOperationException();
            ExtendedLimit limits = new ExtendedLimit();
            limits.BasicLimitInformation.LimitFlags = KillOnJobClose;
            if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimit)))) throw new InvalidOperationException();
            IntPtr attributeSize = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref attributeSize);
            if (attributeSize.ToInt64() <= 0 || attributeSize.ToInt64() > 1048576) throw new InvalidOperationException();
            attributes = Marshal.AllocHGlobal(attributeSize);
            if (!InitializeProcThreadAttributeList(attributes, 2, 0, ref attributeSize)) throw new InvalidOperationException();
            attributesInitialized = true;
            jobList = Marshal.AllocHGlobal(IntPtr.Size);
            Marshal.WriteIntPtr(jobList, job);
            bool jobAttributeSet;
#if SA_OWNER_TEST
            jobAttributeSet = !failJobAttribute && UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x0002000d), jobList,
                new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero);
#else
            jobAttributeSet = UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x0002000d), jobList,
                new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero);
#endif
            if (!jobAttributeSet) throw new InvalidOperationException();
            SecurityAttributes pipeAttributes = new SecurityAttributes();
            pipeAttributes.length = Marshal.SizeOf(typeof(SecurityAttributes)); pipeAttributes.inherit = true;
            if (!CreatePipe(out childInput, out parentInput, ref pipeAttributes, 0)
                || !CreatePipe(out parentOutput, out childOutput, ref pipeAttributes, 0)
                || !CreatePipe(out parentError, out childError, ref pipeAttributes, 0)) throw new InvalidOperationException();
            if (!SetHandleInformation(parentInput, 1, 0) || !SetHandleInformation(parentOutput, 1, 0)
                || !SetHandleInformation(parentError, 1, 0)) throw new InvalidOperationException();
            inherited = Marshal.AllocHGlobal(IntPtr.Size * 3);
            Marshal.WriteIntPtr(inherited, 0, childInput);
            Marshal.WriteIntPtr(inherited, IntPtr.Size, childOutput);
            Marshal.WriteIntPtr(inherited, IntPtr.Size * 2, childError);
            if (!UpdateProcThreadAttribute(attributes, 0, new IntPtr(0x00020002), inherited,
                new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero)) throw new InvalidOperationException();
            StartupInfoEx startup = new StartupInfoEx();
            startup.startup.cb = (uint)Marshal.SizeOf(typeof(StartupInfoEx)); startup.attributes = attributes;
            startup.startup.flags = 0x100; startup.startup.stdInput = childInput;
            startup.startup.stdOutput = childOutput; startup.startup.stdError = childError;
            environment = MinimalEnvironment();
            if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true,
                CreateSuspended | CreateNoWindow | ExtendedStartupInfoPresent | CreateUnicodeEnvironment,
                environment, cwd, ref startup, out child)) throw new InvalidOperationException();
            CloseHandle(childInput); childInput = IntPtr.Zero;
            CloseHandle(childOutput); childOutput = IntPtr.Zero;
            CloseHandle(childError); childError = IntPtr.Zero;
            input = new FileStream(new SafeFileHandle(parentInput, true), FileAccess.Write, 4096, false); parentInput = IntPtr.Zero;
            output = new FileStream(new SafeFileHandle(parentOutput, true), FileAccess.Read, 4096, false); parentOutput = IntPtr.Zero;
            error = new FileStream(new SafeFileHandle(parentError, true), FileAccess.Read, 4096, false); parentError = IntPtr.Zero;
            bool inJob;
            if (!IsProcessInJob(child.process, job, out inJob) || !inJob) throw new InvalidOperationException();
            assigned = true;
#if SA_OWNER_TEST
            if (checkpoint)
            {
                File.WriteAllText(args[2], child.processId.ToString(System.Globalization.CultureInfo.InvariantCulture));
                Thread.Sleep(Timeout.Infinite);
            }
#endif
            if (ResumeThread(child.thread) == UInt32.MaxValue) throw new InvalidOperationException();
            CloseHandle(child.thread); child.thread = IntPtr.Zero;
            outputQueue = new BlockingCollection<OutputFrame>(16);
            outputWriter = new Thread(() => {
                try
                {
                    foreach (OutputFrame frame in outputQueue.GetConsumingEnumerable())
                    {
                        Console.WriteLine(frame.Line); Console.Out.Flush();
                        if (frame.Written != null) frame.Written.Set();
                    }
                }
                catch { Interlocked.Exchange(ref outputFailed, 1); terminateOwnedJob(); }
            });
            outputWriter.IsBackground = true; outputWriter.Start();
            Func<string, bool> emit = value => Interlocked.CompareExchange(ref outputFailed, 0, 0) == 0
                && outputQueue.TryAdd(new OutputFrame { Line = value });
            if (!emit("{\"type\":\"ready\"}")) throw new InvalidOperationException();
            inputQueue = new BlockingCollection<byte[]>(16);
            inputThread = new Thread(() => {
                try
                {
                    foreach (byte[] bytes in inputQueue.GetConsumingEnumerable())
                    {
                        try {
#if SA_OWNER_TEST
                            if (failInput) throw new IOException();
#endif
                            input.Write(bytes, 0, bytes.Length); input.Flush();
                        }
                        finally { Array.Clear(bytes, 0, bytes.Length); }
                    }
                }
                catch { Interlocked.Exchange(ref inputFailed, 1); terminateOwnedJob(); }
            });
            inputThread.IsBackground = true; inputThread.Start();
            Action outputFailure = () => { Interlocked.Exchange(ref outputFailed, 1); terminateOwnedJob(); };
            outputThread = new Thread(() => PumpOutput(output, "stdout", emit, outputFailure)); outputThread.IsBackground = true; outputThread.Start();
            errorThread = new Thread(() => PumpOutput(error, "stderr", emit, outputFailure)); errorThread.IsBackground = true; errorThread.Start();
            controlQueue = new BlockingCollection<string>(16);
            controlReader = new Thread(() => {
                try
                {
                    string commandLine;
                    while ((commandLine = ReadBoundedLine()) != null)
                        if (!controlQueue.TryAdd(commandLine)) throw new InvalidOperationException();
                }
                catch {
                    Interlocked.Exchange(ref controlFailed, 1); terminateOwnedJob();
#if SA_OWNER_TEST
                    if (controlRace) File.WriteAllText(args[2], "fault");
#endif
                }
                finally { controlQueue.CompleteAdding(); }
            });
            controlReader.IsBackground = true; controlReader.Start();
            while (true)
            {
                if (Interlocked.CompareExchange(ref inputFailed, 0, 0) != 0
                    || Interlocked.CompareExchange(ref outputFailed, 0, 0) != 0
                    || Interlocked.CompareExchange(ref controlFailed, 0, 0) != 0) throw new InvalidOperationException();
                string line;
                if (!controlQueue.TryTake(out line, 100))
                {
                    if (controlQueue.IsCompleted) return 1;
                    continue;
                }
                Dictionary<string, object> request = Parse(line);
                object kind;
                if (!request.TryGetValue("type", out kind) || Interlocked.CompareExchange(ref inputFailed, 0, 0) != 0
                    || Interlocked.CompareExchange(ref outputFailed, 0, 0) != 0)
                    throw new InvalidDataException();
                if (Object.Equals(kind, "input"))
                {
                    object encoded;
                    uint activeForInput = Active(job);
                    if (child.process == IntPtr.Zero || WaitForSingleObject(child.process, 0) != 258 || activeForInput == 0
                        || request.Count != 2 || !request.TryGetValue("data", out encoded) || !(encoded is string))
                        throw new InvalidDataException();
                    string text = (string)encoded;
                    if (text.Length == 0 || text.Length > MaximumChunk * 2) throw new InvalidDataException();
                    byte[] bytes = Convert.FromBase64String(text);
                    if (bytes.Length == 0 || bytes.Length > MaximumChunk || Convert.ToBase64String(bytes) != text)
                    { Array.Clear(bytes, 0, bytes.Length); throw new InvalidDataException(); }
                    if (!inputQueue.TryAdd(bytes)) { Array.Clear(bytes, 0, bytes.Length); throw new InvalidOperationException(); }
                    continue;
                }
                if (request.Count != 1) throw new InvalidDataException();
                if (Object.Equals(kind, "status"))
                {
                    uint active = Active(job);
                    if (!emit(active == 0 ? "{\"type\":\"idle\"}" : "{\"type\":\"running\"}")) throw new InvalidOperationException();
                }
#if SA_OWNER_TEST
                else if (Object.Equals(kind, "test-stop-root"))
                {
                    if (child.process == IntPtr.Zero || !TerminateProcess(child.process, 1)
                        || WaitForSingleObject(child.process, 5000) != 0) throw new InvalidOperationException();
                    if (!emit("{\"type\":\"root-stopped\"}")) throw new InvalidOperationException();
                }
#endif
                else if (Object.Equals(kind, "stop"))
                {
                    lock (jobLock) { if (job == IntPtr.Zero || !TerminateJobObject(job, 1)) throw new InvalidOperationException(); }
#if SA_OWNER_TEST
                    if (controlRace)
                    {
                        File.WriteAllText(args[1], "stop");
                        Stopwatch testDeadline = Stopwatch.StartNew();
                        while (!File.Exists(args[3]))
                        {
                            if (testDeadline.ElapsedMilliseconds >= 15000) throw new TimeoutException();
                            Thread.Sleep(10);
                        }
                    }
#endif
                    Stopwatch deadline = Stopwatch.StartNew();
                    while (Active(job) != 0)
                    {
                        if (deadline.ElapsedMilliseconds >= 12000) throw new TimeoutException();
                        Thread.Sleep(20);
                    }
                    inputQueue.CompleteAdding();
                    if (!controlReader.Join(5000) || !inputThread.Join(5000) || !outputThread.Join(5000) || !errorThread.Join(5000))
                        throw new TimeoutException();
                    if (Interlocked.CompareExchange(ref inputFailed, 0, 0) != 0
                        || Interlocked.CompareExchange(ref outputFailed, 0, 0) != 0
                        || Interlocked.CompareExchange(ref controlFailed, 0, 0) != 0 || controlQueue.Count != 0)
                        throw new InvalidOperationException();
                    bool closed;
                    lock (jobLock)
                    {
#if SA_OWNER_TEST
                    closed = !failClose && CloseHandle(job);
#else
                    closed = CloseHandle(job);
#endif
                    if (!closed) throw new InvalidOperationException();
                    job = IntPtr.Zero;
                    }
                    using (ManualResetEventSlim written = new ManualResetEventSlim(false))
                    {
                        if (!outputQueue.TryAdd(new OutputFrame { Line = "{\"type\":\"terminated\",\"active\":0}", Written = written })
                            || !written.Wait(5000) || Interlocked.CompareExchange(ref outputFailed, 0, 0) != 0) throw new InvalidOperationException();
                    }
                    return 0;
                }
                else throw new InvalidDataException();
            }
        }
        catch { return 1; }
        finally
        {
            if (!assigned && child.process != IntPtr.Zero) { TerminateProcess(child.process, 1); WaitForSingleObject(child.process, 5000); }
            if (child.thread != IntPtr.Zero) CloseHandle(child.thread);
            if (child.process != IntPtr.Zero) CloseHandle(child.process);
            lock (jobLock) { if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; } }
            if (inputQueue != null) inputQueue.CompleteAdding();
            if (outputQueue != null) outputQueue.CompleteAdding();
            if (input != null) input.Dispose();
            if (output != null) output.Dispose();
            if (error != null) error.Dispose();
            if (childInput != IntPtr.Zero) CloseHandle(childInput);
            if (parentInput != IntPtr.Zero) CloseHandle(parentInput);
            if (parentOutput != IntPtr.Zero) CloseHandle(parentOutput);
            if (childOutput != IntPtr.Zero) CloseHandle(childOutput);
            if (parentError != IntPtr.Zero) CloseHandle(parentError);
            if (childError != IntPtr.Zero) CloseHandle(childError);
            if (attributesInitialized) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
            if (jobList != IntPtr.Zero) Marshal.FreeHGlobal(jobList);
            if (inherited != IntPtr.Zero) Marshal.FreeHGlobal(inherited);
            if (environment != IntPtr.Zero) Marshal.FreeHGlobal(environment);
        }
    }
}
