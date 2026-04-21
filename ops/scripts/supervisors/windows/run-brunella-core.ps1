param(
    [string]$NodeMaxOldSpaceSize = "",
    [string]$RuntimeMemoryLimitMb = "",
    [string]$RuntimeRestartThresholdMb = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$StartStable = Join-Path $RepoRoot "scripts\start-stable.mjs"
$NodeCommand = Get-Command node.exe -ErrorAction Stop
$ResolvedNodeMaxOldSpaceSize = if ($NodeMaxOldSpaceSize) {
    $NodeMaxOldSpaceSize
} elseif ($env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE) {
    $env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE
} else {
    "1536"
}
$ResolvedRuntimeMemoryLimitMb = if ($RuntimeMemoryLimitMb) {
    $RuntimeMemoryLimitMb
} elseif ($env:BRUNELLA_RUNTIME_MEMORY_LIMIT_MB) {
    $env:BRUNELLA_RUNTIME_MEMORY_LIMIT_MB
} else {
    "2048"
}
$ResolvedRuntimeRestartThresholdMb = if ($RuntimeRestartThresholdMb) {
    $RuntimeRestartThresholdMb
} elseif ($env:BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB) {
    $env:BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB
} else {
    "1792"
}

Set-Location $RepoRoot

if (-not $env:NODE_ENV) {
    $env:NODE_ENV = "production"
}

if (-not $env:WEB_UI_ENABLED) {
    $env:WEB_UI_ENABLED = "true"
}

if (-not $env:BRUNELLA_WORKSPACE_ROOT) {
    $env:BRUNELLA_WORKSPACE_ROOT = $RepoRoot
}

$env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE = $ResolvedNodeMaxOldSpaceSize
$env:BRUNELLA_RUNTIME_MEMORY_LIMIT_MB = $ResolvedRuntimeMemoryLimitMb
$env:BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB = $ResolvedRuntimeRestartThresholdMb

& $NodeCommand.Source "--max-old-space-size=$ResolvedNodeMaxOldSpaceSize" $StartStable
exit $LASTEXITCODE
