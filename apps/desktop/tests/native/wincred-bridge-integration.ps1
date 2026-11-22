param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^pkey-[0-9a-f]{64}$')]
    [string]$Reference
)
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source = Join-Path $PSScriptRoot '../../native/WinCredBridge.cs'
$folder = Join-Path ([System.IO.Path]::GetTempPath()) ('sa-wincred-bridge-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $folder
$binary = Join-Path $folder 'probe.exe'
try {
    & $compiler /nologo /define:SA_WINCRED_TEST /target:exe "/out:$binary" $source | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'NATIVE_BUILD_FAILED' }
    $output = & $binary selftest $Reference
    if ($LASTEXITCODE -ne 0) { throw 'NATIVE_TEST_FAILED' }
    $output
} finally {
    if (Test-Path -LiteralPath $binary -PathType Leaf) { Remove-Item -LiteralPath $binary -Force }
    if (Test-Path -LiteralPath $folder -PathType Container) { Remove-Item -LiteralPath $folder -Force }
}
