<#
.SYNOPSIS
  Copilot Agent Dispatch - BAS agent invocation via REST API
.DESCRIPTION
  PowerShell 5.1+ compatible wrapper for Brunella Agent System.
  Modes: list, execute, route, status
.EXAMPLE
  .\scripts\copilot-dispatch.ps1 -Mode list
  .\scripts\copilot-dispatch.ps1 -Mode execute -AgentName Developer -Task "Fix TS errors"
  .\scripts\copilot-dispatch.ps1 -Mode route -Task "Search AI trends"
  .\scripts\copilot-dispatch.ps1 -Mode status
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("list", "execute", "route", "status")]
    [string]$Mode,

    [string]$AgentName,
    [string]$Task,
    [string]$Context = "{}",
    [string]$BaseUrl = "http://localhost:3000",
    [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8

function Test-ServerRunning {
    try {
        $null = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 5
        return $true
    } catch {
        return $false
    }
}

function Get-SafeValue {
    param($Primary, $Fallback)
    if ($null -ne $Primary -and $Primary -ne "") { return $Primary }
    return $Fallback
}

function Format-AgentResult {
    param([object]$Result)
    if ($Result.success) {
        Write-Host "[OK] Agent: $($Result.executedBy)" -ForegroundColor Green
        if ($Result.message) { Write-Host "  Result: $($Result.message)" }
        if ($Result.data) { $Result.data | ConvertTo-Json -Depth 5 }
    } else {
        $errMsg = Get-SafeValue $Result.error $Result.message
        Write-Host "[FAIL] $errMsg" -ForegroundColor Red
    }
}

# Server check
if (-not (Test-ServerRunning)) {
    Write-Host "[ERROR] BAS server not reachable: $BaseUrl" -ForegroundColor Red
    Write-Host "  Start it: start-full.bat OR npm run dev" -ForegroundColor Yellow
    exit 1
}

switch ($Mode) {
    "list" {
        $agents = Invoke-RestMethod -Uri "$BaseUrl/api/agents" -TimeoutSec 10
        $registry = if ($agents.agents) { $agents.agents } else { $agents }
        $count = 0
        if ($registry -is [array]) { $count = $registry.Count }

        Write-Host ""
        Write-Host "[BAS] Registered agents: $count" -ForegroundColor Cyan
        Write-Host ("=" * 60) -ForegroundColor DarkGray

        foreach ($a in $registry) {
            $name = Get-SafeValue $a.name "?"
            $pri = Get-SafeValue $a.priority "-"
            $caps = "-"
            if ($a.capabilities -and $a.capabilities.Count -gt 0) {
                $caps = ($a.capabilities -join ", ")
            }
            Write-Host "  [$pri] " -NoNewline -ForegroundColor Yellow
            Write-Host "$name" -NoNewline -ForegroundColor White
            Write-Host " - $caps" -ForegroundColor DarkGray
        }

        # Machine-readable JSON output
        $registry | ConvertTo-Json -Depth 3
    }

    "execute" {
        if (-not $AgentName) {
            Write-Host "[ERROR] -AgentName required for execute mode" -ForegroundColor Red
            exit 1
        }
        if (-not $Task) {
            Write-Host "[ERROR] -Task required for execute mode" -ForegroundColor Red
            exit 1
        }

        Write-Host "[DISPATCH] Agent: $AgentName | Task: $Task" -ForegroundColor Cyan

        $bodyObj = @{
            task = $Task
            context = ($Context | ConvertFrom-Json)
        }
        $body = $bodyObj | ConvertTo-Json -Depth 5

        try {
            $result = Invoke-RestMethod `
                -Uri "$BaseUrl/api/agents/$AgentName/execute" `
                -Method POST `
                -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
                -ContentType "application/json; charset=utf-8" `
                -TimeoutSec $TimeoutSec

            Format-AgentResult $result
            $result | ConvertTo-Json -Depth 10
        } catch {
            Write-Host "[ERROR] REST call failed: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }

    "route" {
        if (-not $Task) {
            Write-Host "[ERROR] -Task required for route mode" -ForegroundColor Red
            exit 1
        }

        Write-Host "[ROUTE] Auto-routing: $Task" -ForegroundColor Cyan

        $bodyObj = @{
            task = $Task
            context = ($Context | ConvertFrom-Json)
        }
        $body = $bodyObj | ConvertTo-Json -Depth 5

        try {
            $result = Invoke-RestMethod `
                -Uri "$BaseUrl/api/agents/orchestrate" `
                -Method POST `
                -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
                -ContentType "application/json; charset=utf-8" `
                -TimeoutSec $TimeoutSec

            Format-AgentResult $result
            $result | ConvertTo-Json -Depth 10
        } catch {
            Write-Host "[ERROR] Orchestrator call failed: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }

    "status" {
        $status = Invoke-RestMethod -Uri "$BaseUrl/api/agents/status" -TimeoutSec 10

        Write-Host ""
        Write-Host "[STATUS] Agent states" -ForegroundColor Cyan
        Write-Host ("=" * 50) -ForegroundColor DarkGray

        $agents = if ($status.agents) { $status.agents } else { $status }
        if ($agents -is [hashtable] -or $agents -is [PSCustomObject]) {
            $agents.PSObject.Properties | ForEach-Object {
                $name = $_.Name
                $info = $_.Value
                $stColor = switch ($info.status) {
                    "idle"    { "Green" }
                    "working" { "Yellow" }
                    "error"   { "Red" }
                    default   { "DarkGray" }
                }
                Write-Host "  $name" -NoNewline -ForegroundColor White
                Write-Host " [$($info.status)]" -ForegroundColor $stColor
            }
        } else {
            $agents | ConvertTo-Json -Depth 3
        }
    }
}
