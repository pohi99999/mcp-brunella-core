# FILE: scripts/register_nightly_task.ps1
# PURPOSE: G4.3 — Register nightly training as Windows Task Scheduler job
# Run with elevated privileges: pwsh -RunAs scripts/register_nightly_task.ps1

param(
    [string]$TaskName = "BrunellaNightlyTraining",
    [string]$TriggerTime = "03:00",
    [switch]$Unregister,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptPath = Join-Path $PSScriptRoot "nightly_train.ps1"

if (-not (Test-Path $ScriptPath)) {
    Write-Error "nightly_train.ps1 not found at: $ScriptPath"
    exit 1
}

# ============================================================================
# UNREGISTER
# ============================================================================

if ($Unregister) {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Task '$TaskName' unregistered successfully."
    } catch {
        Write-Host "Task '$TaskName' not found or could not be removed: $_"
    }
    exit 0
}

# ============================================================================
# REGISTER
# ============================================================================

Write-Host "=== Registering Brunella Nightly Training Task ==="
Write-Host "Task Name: $TaskName"
Write-Host "Script:    $ScriptPath"
Write-Host "Schedule:  Daily at $TriggerTime"

if ($DryRun) {
    Write-Host "[DRY RUN] Would register task. No changes made."
    exit 0
}

# Check if already exists
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Task '$TaskName' already exists. Updating..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Build task components
$action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
    -WorkingDirectory $PSScriptRoot

$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At $TriggerTime

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 30)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

# Register
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Brunella Agent System - Nightly fine-tuning training job (Gold Protocol G4.3)"

    Write-Host ""
    Write-Host "Task '$TaskName' registered successfully!"
    Write-Host "Next run: Tomorrow at $TriggerTime"
    Write-Host ""
    Write-Host "Management commands:"
    Write-Host "  Start now:   Start-ScheduledTask -TaskName '$TaskName'"
    Write-Host "  Check:       Get-ScheduledTask -TaskName '$TaskName' | Format-List"
    Write-Host "  Remove:      pwsh scripts/register_nightly_task.ps1 -Unregister"
} catch {
    Write-Error "Failed to register task: $_"
    exit 1
}
