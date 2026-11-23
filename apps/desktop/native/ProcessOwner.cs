using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

// Test-gated native process ownership; this is not a filesystem or network sandbox.
internal static class ProcessOwner
{
    private const uint CreateSuspended = 0x00000004;
    private const uint CreateNoWindow = 0x08000000;
    private const uint ExtendedStartupInfoPresent = 0x00080000;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint KillOnJobClose = 0x00002000;
    private const int MaximumLine = 65536;
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
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeSize);
            if (attributeSize.ToInt64() <= 0 || attributeSize.ToInt64() > 1048576) throw new InvalidOperationException();
            attributes = Marshal.AllocHGlobal(attributeSize);
            if (!InitializeProcThreadAttributeList(attributes, 1, 0, ref attributeSize)) throw new InvalidOperationException();
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
            StartupInfoEx startup = new StartupInfoEx();
            startup.startup.cb = (uint)Marshal.SizeOf(typeof(StartupInfoEx)); startup.attributes = attributes;
            environment = MinimalEnvironment();
            if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, false,
                CreateSuspended | CreateNoWindow | ExtendedStartupInfoPresent | CreateUnicodeEnvironment,
                environment, cwd, ref startup, out child)) throw new InvalidOperationException();
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
#if !SA_OWNER_TEST
            CloseHandle(child.process); child.process = IntPtr.Zero;
#endif
            Console.WriteLine("{\"type\":\"ready\"}"); Console.Out.Flush();
            while (true)
            {
                string line = ReadBoundedLine();
                if (line == null) return 1;
                Dictionary<string, object> request = Parse(line);
                object kind;
                if (request.Count != 1 || !request.TryGetValue("type", out kind)) throw new InvalidDataException();
                if (Object.Equals(kind, "status"))
                {
                    uint active = Active(job);
                    Console.WriteLine(active == 0 ? "{\"type\":\"idle\"}" : "{\"type\":\"running\"}");
                    Console.Out.Flush();
                }
#if SA_OWNER_TEST
                else if (Object.Equals(kind, "test-stop-root"))
                {
                    if (child.process == IntPtr.Zero || !TerminateProcess(child.process, 1)
                        || WaitForSingleObject(child.process, 5000) != 0) throw new InvalidOperationException();
                    Console.WriteLine("{\"type\":\"root-stopped\"}"); Console.Out.Flush();
                }
#endif
                else if (Object.Equals(kind, "stop"))
                {
                    if (!TerminateJobObject(job, 1)) throw new InvalidOperationException();
                    Stopwatch deadline = Stopwatch.StartNew();
                    while (Active(job) != 0)
                    {
                        if (deadline.ElapsedMilliseconds >= 12000) throw new TimeoutException();
                        Thread.Sleep(20);
                    }
                    bool closed;
#if SA_OWNER_TEST
                    closed = !failClose && CloseHandle(job);
#else
                    closed = CloseHandle(job);
#endif
                    if (!closed) throw new InvalidOperationException();
                    job = IntPtr.Zero;
                    Console.WriteLine("{\"type\":\"terminated\",\"active\":0}"); Console.Out.Flush();
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
            if (job != IntPtr.Zero) CloseHandle(job);
            if (attributesInitialized) DeleteProcThreadAttributeList(attributes);
            if (attributes != IntPtr.Zero) Marshal.FreeHGlobal(attributes);
            if (jobList != IntPtr.Zero) Marshal.FreeHGlobal(jobList);
            if (environment != IntPtr.Zero) Marshal.FreeHGlobal(environment);
        }
    }
}
