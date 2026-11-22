using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

public static class WinCredProbe
{
    private const uint Generic = 1;
    private const uint LocalMachine = 2;
    private const int NotFound = 1168;
    private const string Prefix = "SuperAssistant/TestProbe/";

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
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CredDeleteW")]
    private static extern bool CredDelete(string target, uint type, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    private static extern void CredFree(IntPtr buffer);

    private static void Validate(string target)
    {
        if (target == null || !Regex.IsMatch(target, @"\ASuperAssistant/TestProbe/[0-9a-f]{64}\z", RegexOptions.CultureInvariant))
            throw new ArgumentException("Test namespace rejected");
    }

    private static byte[] Read(string target)
    {
        Validate(target);
        IntPtr pointer;
        if (!CredRead(target, Generic, 0, out pointer))
        {
            int error = Marshal.GetLastWin32Error();
            if (error == NotFound) return null;
            throw new Win32Exception(error);
        }
        try
        {
            Credential credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            if (credential.CredentialBlobSize != 32 || credential.CredentialBlob == IntPtr.Zero)
                throw new InvalidOperationException("Invalid credential blob");
            byte[] value = new byte[32];
            Marshal.Copy(credential.CredentialBlob, value, 0, value.Length);
            return value;
        }
        finally { CredFree(pointer); }
    }

    private static bool Equal(byte[] left, byte[] right)
    {
        if (left == null || right == null || left.Length != 32 || right.Length != 32) return false;
        int diff = 0;
        for (int i = 0; i < 32; i++) diff |= left[i] ^ right[i];
        return diff == 0;
    }

    private static bool Create(string target, byte[] value)
    {
        Validate(target);
        byte[] existing = Read(target);
        if (existing != null) { Array.Clear(existing, 0, existing.Length); return false; }
        IntPtr blob = Marshal.AllocHGlobal(value.Length);
        try
        {
            Marshal.Copy(value, 0, blob, value.Length);
            Credential credential = new Credential();
            credential.Type = Generic;
            credential.TargetName = target;
            credential.CredentialBlobSize = (uint)value.Length;
            credential.CredentialBlob = blob;
            credential.Persist = LocalMachine;
            credential.UserName = "SuperAssistant synthetic test";
            if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return true;
        }
        finally
        {
            Marshal.Copy(new byte[value.Length], 0, blob, value.Length);
            Marshal.FreeHGlobal(blob);
        }
    }

    private static bool DeleteIfMatches(string target, byte[] proof)
    {
        Validate(target);
        byte[] existing = Read(target);
        try
        {
            if (!Equal(existing, proof)) return false;
            if (!CredDelete(target, Generic, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return true;
        }
        finally { if (existing != null) Array.Clear(existing, 0, existing.Length); }
    }

    public static string ValidateOnly()
    {
        bool badNamespace = false;
        bool badName = false;
        try { Validate("SuperAssistant/ProtectedPayload/" + new string('a', 64)); } catch (ArgumentException) { badNamespace = true; }
        try { Validate(Prefix + "../x"); } catch (ArgumentException) { badName = true; }
        return "{\"wrongNamespaceRejected\":" + badNamespace.ToString().ToLowerInvariant()
            + ",\"malformedNameRejected\":" + badName.ToString().ToLowerInvariant() + "}";
    }

    public static string SelfTest(string target)
    {
        Validate(target);
        byte[] value = new byte[32];
        byte[] wrong = new byte[32];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(value); rng.GetBytes(wrong);
        }
        wrong[0] = (byte)(value[0] ^ 1);
        string suffix = target.Substring(Prefix.Length);
        bool created = false;
        bool cleaned = false;
        using (Mutex mutex = new Mutex(false, "Local\\SuperAssistant-WinCred-Test-" + suffix))
        {
            if (!mutex.WaitOne(TimeSpan.FromSeconds(10))) throw new InvalidOperationException("Test lock timeout");
            try
            {
                created = Create(target, value);
                if (!created) throw new InvalidOperationException("Test target already exists");
                byte[] observed = Read(target);
                bool readMatches = Equal(observed, value);
                if (observed != null) Array.Clear(observed, 0, observed.Length);
                bool duplicateRejected = !Create(target, value);
                bool rejectedWrongProof = !DeleteIfMatches(target, wrong);
                byte[] afterWrongProof = Read(target);
                bool wrongProofPreserved = rejectedWrongProof && Equal(afterWrongProof, value);
                if (afterWrongProof != null) Array.Clear(afterWrongProof, 0, afterWrongProof.Length);
                bool deleted = DeleteIfMatches(target, value);
                byte[] afterDelete = Read(target);
                cleaned = deleted && afterDelete == null;
                if (afterDelete != null) Array.Clear(afterDelete, 0, afterDelete.Length);
                return "{\"created\":" + created.ToString().ToLowerInvariant()
                    + ",\"readMatches\":" + readMatches.ToString().ToLowerInvariant()
                    + ",\"duplicateRejected\":" + duplicateRejected.ToString().ToLowerInvariant()
                    + ",\"wrongProofPreserved\":" + wrongProofPreserved.ToString().ToLowerInvariant()
                    + ",\"exactCleanup\":" + cleaned.ToString().ToLowerInvariant() + "}";
            }
            finally
            {
                if (created && !cleaned) DeleteIfMatches(target, value);
                Array.Clear(value, 0, value.Length); Array.Clear(wrong, 0, wrong.Length);
                mutex.ReleaseMutex();
            }
        }
    }
}
