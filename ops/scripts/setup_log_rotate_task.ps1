# Brunella Log Rotáció - Windows Task Scheduler Regisztráció
# Futtatás: PowerShell (Rendszergazdaként)
# .\scripts\setup_log_rotate_task.ps1

param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = "BrunellaLogRotation",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

# Feladat eltávolítása ha szükséges
if ($Remove) {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[OK] Task '$TaskName' eltávolítva." -ForegroundColor Green
    } catch {
        Write-Host "[!!] Task nem található: $TaskName" -ForegroundColor Yellow
    }
    exit 0
}

$ScriptPath = Join-Path $ProjectRoot "scripts\log_rotate.bat"

if (-not (Test-Path $ScriptPath)) {
    Write-Host "[!!] Nem található: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "[..] Brunella Log Rotáció Task Scheduler regisztráció" -ForegroundColor Cyan
Write-Host "     Projekt: $ProjectRoot"
Write-Host "     Script:  $ScriptPath"
Write-Host "     Task:    $TaskName"
Write-Host ""

# Action: cmd.exe /c log_rotate.bat
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$ScriptPath`" >> `"$ProjectRoot\logs\log_rotate_scheduler.log`" 2>&1" `
    -WorkingDirectory $ProjectRoot

# Trigger: minden hétfőn 03:00-kor
$Trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday `
    -At "03:00"

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -WakeToRun:$false

# Principal: aktuális felhasználó
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

try {
    # Ha már létezik, frissítjük
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Set-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings
        Write-Host "[OK] Task frissítve: $TaskName" -ForegroundColor Green
    } else {
        Register-ScheduledTask `
            -TaskName $TaskName `
            -Action $Action `
            -Trigger $Trigger `
            -Settings $Settings `
            -Principal $Principal `
            -Description "Brunella logfájl rotáció - heti automatikus archív" `
            -Force | Out-Null
        Write-Host "[OK] Task regisztrálva: $TaskName" -ForegroundColor Green
    }
} catch {
    Write-Host "[!!] Hiba a task regisztrálásánál: $_" -ForegroundColor Red
    Write-Host "     Próbáld Rendszergazdaként futtatni!" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Ütemezés: minden Hétfőn 03:00" -ForegroundColor Cyan
Write-Host "Azonnali teszt futtatáshoz:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  VAGY: cmd /c `"$ScriptPath`"" -ForegroundColor Gray
Write-Host ""
Write-Host "Eltávolításhoz:"
Write-Host "  .\scripts\setup_log_rotate_task.ps1 -Remove" -ForegroundColor Gray
