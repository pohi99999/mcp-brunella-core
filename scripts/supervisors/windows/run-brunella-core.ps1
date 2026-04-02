$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$StartStable = Join-Path $RepoRoot "scripts\start-stable.mjs"
$NodeCommand = Get-Command node.exe -ErrorAction Stop
$NodeMaxOldSpaceSize = if ($env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE) {
    $env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE
} else {
    "3072"
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

& $NodeCommand.Source "--max-old-space-size=$NodeMaxOldSpaceSize" $StartStable
exit $LASTEXITCODE
