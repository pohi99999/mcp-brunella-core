Param(
    [string]$McpUrl = "http://localhost:3000",
    [string]$StartCmd = "start-full.bat",
    [int]$TimeoutSec = 120
)

# Resolve repository root (script is in scripts/)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StartPath = Join-Path $RepoRoot $StartCmd

function Test-Url($url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

Write-Output "Checking Brunella at $McpUrl..."
if (-not (Test-Url $McpUrl)) {
    Write-Output "Brunella not running. Starting: $StartCmd"
    Start-Process -FilePath $StartPath -WorkingDirectory $RepoRoot -WindowStyle Minimized
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while (-not (Test-Url $McpUrl) -and $sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
        Start-Sleep -Seconds 2
    }
    if (-not (Test-Url $McpUrl)) {
        Write-Error "Timeout waiting for Brunella at $McpUrl"
        exit 1
    }
    Write-Output "Brunella is running at $McpUrl."
} else {
    Write-Output "Brunella already running at $McpUrl"
}

# Build copilot args, optionally include additional-mcp-config from repo scripts
$extraCfg = Join-Path $PSScriptRoot 'copilot-mcp-config.json'
$copilotArgs = @()
if (Test-Path $extraCfg) {
    Write-Output "Using additional MCP config: $extraCfg"
    $copilotArgs += '--additional-mcp-config'
    $copilotArgs += "@$extraCfg"
}
if ($args) { $copilotArgs += $args }

if (Get-Command copilot -ErrorAction SilentlyContinue) {
    Write-Output "Launching Copilot CLI with arguments: $copilotArgs"
    & copilot @copilotArgs
} else {
    Write-Output "Copilot CLI not found in PATH. Please install Copilot CLI or run 'copilot' directly."
    exit 2
}