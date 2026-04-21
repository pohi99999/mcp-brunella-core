# PowerShell Script - Windows Task Scheduler Setup Jules Sync-hez
# Futtatás: powershell -ExecutionPolicy Bypass -File scripts\setup_jules_sync_task.ps1

$TaskName = "JulesSyncWatchdog"
$ScriptPath = "$PWD\scripts\jules_sync_watchdog.py"
$PythonPath = (Get-Command python).Source
$WorkingDir = "$PWD"

Write-Host "🔧 Jules Sync Task Scheduler Setup" -ForegroundColor Cyan
Write-Host "=" * 60

# Ellenőrzés: létezik-e már a task
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "⚠️ Task már létezik: $TaskName" -ForegroundColor Yellow
    $Confirm = Read-Host "Törlöd és újra létrehozod? (y/n)"
    if ($Confirm -eq 'y') {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✅ Régi task törölve" -ForegroundColor Green
    } else {
        Write-Host "❌ Megszakítva" -ForegroundColor Red
        exit
    }
}

# Task Action (Python script futtatás)
$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "$ScriptPath --once" `
    -WorkingDirectory $WorkingDir

# Trigger (óránként)
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Principal (futtatás a jelenlegi felhasználóval)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

# Task regisztrálás
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Jules GitHub branch-ek automatikus szinkronizálása óránként"

Write-Host ""
Write-Host "✅ Task sikeresen létrehozva: $TaskName" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Parancsok:" -ForegroundColor Cyan
Write-Host "   Státusz: Get-ScheduledTask -TaskName $TaskName"
Write-Host "   Azonnali futtatás: Start-ScheduledTask -TaskName $TaskName"
Write-Host "   Törlés: Unregister-ScheduledTask -TaskName $TaskName"
Write-Host "   Log megtekintés: cat logs\jules_sync.log"
Write-Host ""
Write-Host "🔁 A task óránként automatikusan fut!" -ForegroundColor Green
