# ============================================================================
# Brunella Agent System - Full System Test Script
# ============================================================================
# Purpose: Comprehensive diagnostic and testing of all system components
# Date: 2026-01-30
# ============================================================================

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  BRUNELLA SYSTEM - FULL DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# ============================================================================
# FASE 1: Environment & Configuration Check
# ============================================================================
Write-Host "`n[FASE 1] Environment Configuration Check" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

# Check .env file
Write-Host "`n1.1 Checking .env file..." -ForegroundColor White
if (Test-Path ".env") {
    Write-Host "  [OK] .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
    $portVal = "(not set)"; $ollamaVal = "(not set)"; $allmVal = "(not set)"
    $m = $envContent | Select-String "^PORT="; if ($m) { $portVal = ($m.ToString() -split "=", 2)[1].Trim() }
    $m = $envContent | Select-String "OLLAMA_BASE_URL="; if ($m) { $ollamaVal = ($m.ToString() -split "=", 2)[1].Trim() }
    $m = $envContent | Select-String "ANYTHINGLLM_BASE_URL="; if ($m) { $allmVal = ($m.ToString() -split "=", 2)[1].Trim() }
    Write-Host "  - PORT: $portVal" -ForegroundColor Gray
    Write-Host "  - OLLAMA_BASE_URL: $ollamaVal" -ForegroundColor Gray
    Write-Host "  - ANYTHINGLLM_BASE_URL: $allmVal" -ForegroundColor Gray
} else {
    Write-Host "  [X] .env file NOT FOUND!" -ForegroundColor Red
}

# Check config/index.ts
Write-Host "`n1.2 Checking src/config/index.ts..." -ForegroundColor White
$configPath = "src/config/index.ts"
if (Test-Path $configPath) {
    Write-Host "  [OK] Config file exists" -ForegroundColor Green
} else {
    Write-Host "  [X] Config file NOT FOUND" -ForegroundColor Red
}

# ============================================================================
# FASE 2: Ollama Installation Check
# ============================================================================
Write-Host "`n[FASE 2] Ollama Installation Diagnostics" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n2.1 Finding Ollama installations..." -ForegroundColor White
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCmd) {
    Write-Host "  âś“ Ollama found in PATH: $($ollamaCmd.Source)" -ForegroundColor Green
} else {
    Write-Host "  âś— Ollama NOT found in PATH!" -ForegroundColor Red
}

# Check common installation paths
$ollamaPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama",
    "C:\Program Files\Ollama",
    "C:\Program Files (x86)\Ollama"
)

Write-Host "`n2.2 Checking installation directories..." -ForegroundColor White
foreach ($path in $ollamaPaths) {
    if (Test-Path $path) {
        Write-Host "  âś“ Found: $path" -ForegroundColor Green
        $files = Get-ChildItem $path -File -ErrorAction SilentlyContinue | Select-Object Name, Length
        foreach ($file in $files) {
            Write-Host "    - $($file.Name) ($([math]::Round($file.Length/1MB, 2)) MB)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  â€˘ Not found: $path" -ForegroundColor Gray
    }
}
