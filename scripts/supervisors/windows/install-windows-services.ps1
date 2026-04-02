param(
    [switch]$StartServices = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Administrator {
    $CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($CurrentIdentity)
    if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script from an elevated PowerShell window."
    }
}

function Ensure-Service {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$Description,
        [string]$BinaryPath,
        [string[]]$Dependencies = @()
    )

    $Existing = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $Existing) {
        New-Service -Name $Name -BinaryPathName $BinaryPath -DisplayName $DisplayName -StartupType Automatic
    }

    & sc.exe config $Name start= auto binPath= $BinaryPath | Out-Null
    if ($Dependencies.Count -gt 0) {
        & sc.exe config $Name depend= ($Dependencies -join "/") | Out-Null
    }
    & sc.exe description $Name $Description | Out-Null
}

Assert-Administrator

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$PwshPath = if (Test-Path (Join-Path $PSHOME "pwsh.exe")) {
    Join-Path $PSHOME "pwsh.exe"
} else {
    (Get-Command powershell.exe -ErrorAction Stop).Source
}

$PythonRunner = Join-Path $RepoRoot "scripts\supervisors\windows\run-brunella-python.ps1"
$CoreRunner = Join-Path $RepoRoot "scripts\supervisors\windows\run-brunella-core.ps1"
$PythonBinaryPath = "`"$PwshPath`" -NoProfile -ExecutionPolicy Bypass -File `"$PythonRunner`""
$CoreBinaryPath = "`"$PwshPath`" -NoProfile -ExecutionPolicy Bypass -File `"$CoreRunner`""

Ensure-Service `
    -Name "BrunellaPython" `
    -DisplayName "Brunella Python Runtime" `
    -Description "Brunella FastAPI runtime." `
    -BinaryPath $PythonBinaryPath

Ensure-Service `
    -Name "BrunellaCore" `
    -DisplayName "Brunella Core Control Plane" `
    -Description "Brunella Node.js control plane and dashboard runtime." `
    -BinaryPath $CoreBinaryPath `
    -Dependencies @("BrunellaPython", "Tcpip")

if ($StartServices) {
    Start-Service -Name "BrunellaPython" -ErrorAction SilentlyContinue
    Start-Service -Name "BrunellaCore" -ErrorAction SilentlyContinue
}

Write-Host "Windows services configured:" -ForegroundColor Cyan
Write-Host "  BrunellaPython" -ForegroundColor Green
Write-Host "  BrunellaCore" -ForegroundColor Green
Write-Host ""
Write-Host "Canonical manual entrypoint remains: inditas.bat" -ForegroundColor Yellow
