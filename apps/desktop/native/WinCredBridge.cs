using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;

internal static class WinCredBridge
{
    private const uint Generic = 1;
    private const uint LocalMachine = 2;
    private const int NotFound = 1168;
#if SA_WINCRED_TEST
    private const string Prefix = "SuperAssistant/TestBridge/";
#else
    private const string Prefix = "SuperAssistant/ProtectedPayload/";
#endif
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CredReadW")]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CredWriteW")]
    private static extern bool CredWrite(ref Credential credential, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    private static extern void CredFree(IntPtr buffer);
#if SA_WINCRED_TEST
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CredDeleteW")]
    private static extern bool CredDelete(string target, uint type, uint flags);
#endif
    private static bool ValidReference(string reference)
    {
        return reference != null && Regex.IsMatch(reference, @"\Apkey-[0-9a-f]{64}\z", RegexOptions.CultureInvariant);
    }
    private static byte[] Read(string target)
    {
        IntPtr ptr;
        if (!CredRead(target, Generic, 0, out ptr))
        {
            int error = Marshal.GetLastWin32Error();
            if (error == NotFound) return null;
            throw new Win32Exception(error);
        }
        IntPtr blob = IntPtr.Zero;
        try
        {
            Credential credential = (Credential)Marshal.PtrToStructure(ptr, typeof(Credential));
            if (credential.CredentialBlobSize != 32 || credential.CredentialBlob == IntPtr.Zero)
                throw new InvalidOperationException("Invalid credential");
            blob = credential.CredentialBlob;
            byte[] key = new byte[32];
            Marshal.Copy(blob, key, 0, key.Length);
            return key;
        }
        finally
        {
            try { if (blob != IntPtr.Zero) Marshal.Copy(new byte[32], 0, blob, 32); }
            finally { CredFree(ptr); }
        }
    }
    private static bool Equal(byte[] left, byte[] right)
    {
        if (left == null || right == null || left.Length != 32 || right.Length != 32) return false;
        int difference = 0;
        for (int i = 0; i < 32; i++) difference |= left[i] ^ right[i];
        return difference == 0;
    }
    private static bool Create(string target, byte[] key)
    {
        byte[] existing = Read(target);
        if (existing != null) { Array.Clear(existing, 0, existing.Length); return false; }
        IntPtr blob = Marshal.AllocHGlobal(key.Length);
        try
        {
            Marshal.Copy(key, 0, blob, key.Length);
            Credential credential = new Credential();
            credential.Type = Generic; credential.TargetName = target;
            credential.CredentialBlobSize = (uint)key.Length; credential.CredentialBlob = blob;
            credential.Persist = LocalMachine; credential.UserName = "SuperAssistant protected key";
            if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return true;
        }
        finally { Marshal.Copy(new byte[key.Length], 0, blob, key.Length); Marshal.FreeHGlobal(blob); }
    }
#if SA_WINCRED_TEST
    private static bool DeleteMatching(string target, byte[] proof)
    {
        byte[] found = Read(target);
        try
        {
            if (!Equal(found, proof)) return false;
            if (!CredDelete(target, Generic, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return true;
        }
        finally { if (found != null) Array.Clear(found, 0, found.Length); }
    }
    private static int SelfTest(string target)
    {
        byte[] key = new byte[32]; byte[] wrong = new byte[32];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create()) { rng.GetBytes(key); rng.GetBytes(wrong); }
        wrong[0] = (byte)(key[0] ^ 1);
        bool created = false; bool cleaned = false;
        try
        {
            created = Create(target, key);
            if (!created) return 3;
            byte[] observed = Read(target);
            bool matches = Equal(key, observed);
            if (observed != null) Array.Clear(observed, 0, observed.Length);
            bool duplicate = !Create(target, key);
            bool wrongRejected = !DeleteMatching(target, wrong);
            byte[] remains = Read(target);
            bool preserved = wrongRejected && Equal(key, remains);
            if (remains != null) Array.Clear(remains, 0, remains.Length);
            bool deleted = DeleteMatching(target, key);
            byte[] after = Read(target);
            cleaned = deleted && after == null;
            if (after != null) Array.Clear(after, 0, after.Length);
            Console.Write("{\"created\":" + created.ToString().ToLowerInvariant()
              + ",\"readMatches\":" + matches.ToString().ToLowerInvariant()
              + ",\"duplicateRejected\":" + duplicate.ToString().ToLowerInvariant()
              + ",\"wrongProofPreserved\":" + preserved.ToString().ToLowerInvariant()
              + ",\"exactCleanup\":" + cleaned.ToString().ToLowerInvariant() + "}");
            return matches && duplicate && preserved && cleaned ? 0 : 1;
        }
        finally
        {
            if (created && !cleaned) DeleteMatching(target, key);
            Array.Clear(key, 0, key.Length); Array.Clear(wrong, 0, wrong.Length);
        }
    }
#endif
    private static int Main(string[] args)
    {
        if (args.Length != 2 || !ValidReference(args[1])) return 1;
        string operation = args[0]; string reference = args[1]; string target = Prefix + reference;
        if (operation != "create" && operation != "read"
#if SA_WINCRED_TEST
            && operation != "selftest" && operation != "cleanup"
#endif
            ) return 1;
        try
        {
            using (Mutex mutex = new Mutex(false, "Global\\SuperAssistant-WinCred-" + reference))
            {
                bool held = false;
                try
                {
                    try { held = mutex.WaitOne(TimeSpan.FromSeconds(7)); }
                    catch (AbandonedMutexException) { mutex.ReleaseMutex(); return 1; }
                    if (!held) return 1;
#if SA_WINCRED_TEST
                    if (operation == "selftest") return SelfTest(target);
                    if (operation == "cleanup")
                    {
                        byte[] proof = new byte[32];
                        try
                        {
                            using (Stream input = Console.OpenStandardInput())
                            {
                                int offset = 0;
                                while (offset < proof.Length)
                                {
                                    int count = input.Read(proof, offset, proof.Length - offset);
                                    if (count <= 0) return 1;
                                    offset += count;
                                }
                                if (input.ReadByte() != -1) return 1;
                            }
                            return DeleteMatching(target, proof) ? 0 : 1;
                        }
                        finally { Array.Clear(proof, 0, proof.Length); }
                    }
#endif
                    byte[] key = null;
                    try
                    {
                        if (operation == "create")
                        {
                            key = new byte[32];
                            using (RandomNumberGenerator rng = RandomNumberGenerator.Create()) rng.GetBytes(key);
                            if (!Create(target, key)) return 3;
                        }
                        else
                        {
                            key = Read(target);
                            if (key == null) return 2;
                        }
                        using (Stream stdout = Console.OpenStandardOutput()) { stdout.Write(key, 0, key.Length); stdout.Flush(); }
                        return 0;
                    }
                    finally { if (key != null) Array.Clear(key, 0, key.Length); }
                }
                finally { if (held) mutex.ReleaseMutex(); }
            }
        }
        catch { return 1; }
    }
}
