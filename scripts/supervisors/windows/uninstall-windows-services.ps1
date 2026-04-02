$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Administrator {
    $CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($CurrentIdentity)
    if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this script from an elevated PowerShell window."
    }
}

Assert-Administrator

foreach ($ServiceName in @("BrunellaCore", "BrunellaPython")) {
    $Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $Service) {
        Write-Host "Service not installed: $ServiceName" -ForegroundColor Yellow
        continue
    }

    if ($Service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    & sc.exe delete $ServiceName | Out-Null
    Write-Host "Removed service: $ServiceName" -ForegroundColor Green
}
