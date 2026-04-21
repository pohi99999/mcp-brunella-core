$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ServiceNames = @("BrunellaPython", "BrunellaCore")

function Get-ServiceSummary {
    param([string]$Name)

    $Service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $Service) {
        return [PSCustomObject]@{
            Name = $Name
            Installed = $false
            Status = "not-installed"
            StartMode = "n/a"
        }
    }

    $ServiceConfig = Get-CimInstance Win32_Service -Filter "Name='$Name'"
    return [PSCustomObject]@{
        Name = $Name
        Installed = $true
        Status = $Service.Status.ToString().ToLowerInvariant()
        StartMode = $ServiceConfig.StartMode.ToLowerInvariant()
        PathName = $ServiceConfig.PathName
    }
}

function Get-CoreRuntimeContract {
    $Summary = Get-ServiceSummary -Name "BrunellaCore"
    $PathName = if ($Summary.Installed) { [string]$Summary.PathName } else { "" }

    $HeapMatch = [regex]::Match($PathName, '-NodeMaxOldSpaceSize\s+"?(\d+)"?')
    $LimitMatch = [regex]::Match($PathName, '-RuntimeMemoryLimitMb\s+"?(\d+)"?')
    $RestartMatch = [regex]::Match($PathName, '-RuntimeRestartThresholdMb\s+"?(\d+)"?')

    return [PSCustomObject]@{
        HeapMb = if ($HeapMatch.Success) { $HeapMatch.Groups[1].Value } elseif ($env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE) { $env:BRUNELLA_NODE_MAX_OLD_SPACE_SIZE } else { "1536" }
        RuntimeLimitMb = if ($LimitMatch.Success) { $LimitMatch.Groups[1].Value } elseif ($env:BRUNELLA_RUNTIME_MEMORY_LIMIT_MB) { $env:BRUNELLA_RUNTIME_MEMORY_LIMIT_MB } else { "2048" }
        RestartThresholdMb = if ($RestartMatch.Success) { $RestartMatch.Groups[1].Value } elseif ($env:BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB) { $env:BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB } else { "1792" }
    }
}

function Get-EndpointStatus {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return [PSCustomObject]@{
            Name = $Name
            Status = "ok"
            Http = $Response.StatusCode
        }
    } catch {
        return [PSCustomObject]@{
            Name = $Name
            Status = "unavailable"
            Http = "n/a"
        }
    }
}

Write-Host "Windows service status:" -ForegroundColor Cyan
foreach ($ServiceName in $ServiceNames) {
    $Summary = Get-ServiceSummary -Name $ServiceName
    Write-Host ("  {0}: installed={1} status={2} startMode={3}" -f $Summary.Name, $Summary.Installed, $Summary.Status, $Summary.StartMode)
}

Write-Host ""
$Contract = Get-CoreRuntimeContract
Write-Host "Runtime contract:" -ForegroundColor Cyan
Write-Host ("  BrunellaCore: heapMb={0} runtimeLimitMb={1} restartThresholdMb={2}" -f $Contract.HeapMb, $Contract.RuntimeLimitMb, $Contract.RestartThresholdMb)

Write-Host ""
Write-Host "Runtime endpoints:" -ForegroundColor Cyan
foreach ($Endpoint in @(
    @{ Name = "Brunella Ready"; Url = "http://localhost:3000/readyz" },
    @{ Name = "Brunella Live"; Url = "http://localhost:3000/livez" },
    @{ Name = "Python Health"; Url = "http://localhost:8000/health" }
)) {
    $Status = Get-EndpointStatus -Name $Endpoint.Name -Url $Endpoint.Url
    Write-Host ("  {0}: {1} ({2})" -f $Status.Name, $Status.Status, $Status.Http)
}
