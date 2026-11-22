param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('validate', 'selftest')]
    [string]$Mode,
    [string]$Target
)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -Path (Join-Path $PSScriptRoot 'WinCredProbe.cs')
    if ($Mode -eq 'validate') {
        [WinCredProbe]::ValidateOnly()
    } else {
        [WinCredProbe]::SelfTest($Target)
    }
} catch {
    [Console]::Error.WriteLine('WINCRED_PROBE_FAILED')
    exit 1
}
