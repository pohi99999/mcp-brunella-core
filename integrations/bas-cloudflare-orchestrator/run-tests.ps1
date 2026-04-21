# BAS Cloudflare Orchestrator - Integrációs Tesztek
# Futtatás: .\run-tests.ps1
# Előfeltétel: Worker deployolva, szolgáltatások futnak

$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location | Select-Object -ExpandProperty Path }
$TestResultsPath = Join-Path $ProjectRoot "TEST_RESULTS.md"
$WorkerUrl = "https://bas-orchestrator.iam-dd1.workers.dev"

Write-Host "=== BAS Integrációs Tesztek ===" -ForegroundColor Cyan
Write-Host "Worker URL: $WorkerUrl" -ForegroundColor Gray
Write-Host ""

# TESZT 1: Health Check
Write-Host "TESZT 1: Cloudflare Worker Health..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri $WorkerUrl -Method Get -TimeoutSec 30
    Write-Host "  OK - $($r.service)" -ForegroundColor Green
    $test1 = "OK"
} catch {
    Write-Host "  HIBA: $_" -ForegroundColor Red
    $test1 = "HIBA"
}

# TESZT 2: Research Task
Write-Host "TESZT 2: Research Task beküldés..." -ForegroundColor Yellow
try {
    $body = '{"instruction":"Mi a Cloudflare Workers?","context":{"priority":"normal"}}'
    $r = Invoke-RestMethod -Uri "$WorkerUrl/task" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 60
    Write-Host "  OK - Task ID: $($r.taskId), Type: $($r.type)" -ForegroundColor Green
    $lastTaskId = $r.taskId
    $test2 = "OK"
} catch {
    Write-Host "  HIBA: $_" -ForegroundColor Red
    $test2 = "HIBA"
}

# TESZT 3: Task Status
if ($lastTaskId) {
    Write-Host "TESZT 3: Task státusz lekérdezés ($lastTaskId)..." -ForegroundColor Yellow
    try {
        $r = Invoke-RestMethod -Uri "$WorkerUrl/status/$lastTaskId" -Method Get -TimeoutSec 30
        Write-Host "  OK - Status: $($r.status)" -ForegroundColor Green
        $test3 = "OK"
    } catch {
        Write-Host "  HIBA: $_" -ForegroundColor Red
        $test3 = "HIBA"
}
} else { $test3 = "KIHAGYVA" }

# TESZT 4: Browser-Use API (ha fut)
Write-Host "TESZT 4: Browser-Use API (localhost:8000)..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "http://localhost:8000/" -Method Get -TimeoutSec 5
    Write-Host "  OK - $($r.service)" -ForegroundColor Green
    $test4 = "OK"
} catch {
    Write-Host "  NEM ELÉRHETŐ (opcionális)" -ForegroundColor Yellow
    $test4 = "NEM FUT"
}

# Összefoglaló
Write-Host ""
Write-Host "=== Összefoglaló ===" -ForegroundColor Cyan
Write-Host "1. Worker Health: $test1"
Write-Host "2. Research Task: $test2"
Write-Host "3. Task Status:   $test3"
Write-Host "4. Browser-Use:  $test4"
Write-Host ""
Write-Host "Eredmények: $TestResultsPath" -ForegroundColor Gray
