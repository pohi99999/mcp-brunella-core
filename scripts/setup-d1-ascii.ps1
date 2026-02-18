# CEAN Phase 2A - D1 Database Setup (Simple)
# Simple automation for D1 database creation via Cloudflare API

param(
    [Parameter(Mandatory = $false)]
    [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN,
    
    [Parameter(Mandatory = $false)]
    [string]$AccountId = $env:CLOUDFLARE_ACCOUNT_ID,
    
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = "f:\mcp-brunella-core"
)

$ErrorActionPreference = "Stop"

# Configuration
$Config = @{
    ApiBase = "https://api.cloudflare.com/client/v4"
    DatabaseName = "bas-metadata"
    BindingName = "DB"
    WorkerPath = "$ProjectRoot\myai\agents\workers\cean-test"
    WranglerConfig = "$ProjectRoot\myai\agents\workers\cean-test\wrangler.toml"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CEAN Phase 2A - D1 Database Setup (Simple)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "[CHECK] Checking prerequisites..." -ForegroundColor Green

if (-not $ApiToken) {
    Write-Host "[ERROR] CLOUDFLARE_API_TOKEN not found" -ForegroundColor Red
    exit 1
}

if (-not $AccountId) {
    Write-Host "[ERROR] CLOUDFLARE_ACCOUNT_ID not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ProjectRoot)) {
    Write-Host "[ERROR] Project root not found: $ProjectRoot" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Prerequisites verified" -ForegroundColor Green
Write-Host ""

# Step 1: Test API auth
Write-Host "[1/4] Testing Cloudflare API authentication..." -ForegroundColor Cyan

$apiOk = $false

try {
    $headers = @{
        "Authorization" = "Bearer $ApiToken"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-WebRequest `
        -Uri "$($Config.ApiBase)/accounts/$AccountId/r2/buckets" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec 10
    
    Write-Host "[OK] API authentication successful" -ForegroundColor Green
    $apiOk = $true
} catch {
    Write-Host "[WARN] API connection failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "[INFO] Will attempt manual fallback" -ForegroundColor Yellow
}

# Step 2: Create D1 database
Write-Host ""
Write-Host "[2/4] Creating D1 database named '$($Config.DatabaseName)'..." -ForegroundColor Cyan

$dbId = $null

if ($apiOk) {
    try {
        $body = @{ name = $Config.DatabaseName } | ConvertTo-Json
        
        $response = Invoke-WebRequest `
            -Uri "$($Config.ApiBase)/accounts/$AccountId/d1/database" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 10
        
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success -eq $true -and $data.result) {
            $dbId = $data.result.id
            Write-Host "[OK] D1 database created: $dbId" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] API error: Unable to create database" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[WARN] Automatic creation failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Fallback to manual
if (-not $dbId) {
    Write-Host ""
    Write-Host "[MANUAL] D1 Creation Required:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Go to: https://dash.cloudflare.com/" -ForegroundColor Gray
    Write-Host "  2. Navigate: Workers & Pages > D1" -ForegroundColor Gray
    Write-Host "  3. Click: Create Database" -ForegroundColor Gray
    Write-Host "  4. Enter name: $($Config.DatabaseName)" -ForegroundColor Gray
    Write-Host "  5. Click: Create" -ForegroundColor Gray
    Write-Host "  6. Copy the Database ID (looks like: d1_xxxxxxxxxxxxx)" -ForegroundColor Gray
    Write-Host ""
    
    $dbId = Read-Host "Enter your Database ID (d1_...)"
    
    if (-not ($dbId -match "^d1_[a-zA-Z0-9]+")) {
        Write-Host "[ERROR] Invalid Database ID format. Must start with 'd1_'" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Using Database ID: $dbId" -ForegroundColor Green
}

# Step 3: Update wrangler.toml
Write-Host ""
Write-Host "[3/4] Updating wrangler.toml with binding..." -ForegroundColor Cyan

try {
    $content = Get-Content $Config.WranglerConfig -Raw
    
    # Remove existing D1 binding if present
    $content = $content -replace "`r`n`r`n\[\[d1_databases\]\].*?(?=`r`n`r`n|\Z)", ""
    
    # Add new binding at end
    $newBinding = "`n`n# D1 Database Binding (Phase 2A)`n[[d1_databases]]`nbinding = `"$($Config.BindingName)`"`ndatabase_name = `"$($Config.DatabaseName)`"`ndatabase_id = `"$dbId`"`n"
    $content = $content + $newBinding
    
    Set-Content -Path $Config.WranglerConfig -Value $content -Encoding UTF8 -NoNewline
    Write-Host "[OK] wrangler.toml updated successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to update wrangler.toml: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Build & Deploy
Write-Host ""
Write-Host "[4/4] Building and deploying worker..." -ForegroundColor Cyan

try {
    Push-Location $Config.WorkerPath
    
    Write-Host "[...] Running npm build" -ForegroundColor Gray
    npm run build 2>&1 | Out-Null
    
    Write-Host "[...] Running wrangler deploy" -ForegroundColor Gray
    wrangler deploy --env production 2>&1 | Out-Null
    
    Pop-Location
    Write-Host "[OK] Worker deployed to production" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Build/deploy failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($PSItem.InvocationInfo.MyCommand.Name) {
        Pop-Location
    }
    exit 1
}

# Summary
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  PHASE 2A D1 SETUP COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Database ID     : $dbId" -ForegroundColor Green
Write-Host "  Worker URL      : https://cean-test.peterpohankapersonal.workers.dev" -ForegroundColor Green
Write-Host ""
Write-Host "[NEXT] Test D1 connectivity:" -ForegroundColor Cyan
Write-Host '  Invoke-WebRequest -Uri "https://cean-test.peterpohankapersonal.workers.dev/test/d1" -Method POST -Body ''{"action":"check"}'' -ContentType "application/json"' -ForegroundColor Gray
Write-Host ""
Write-Host "[NEXT] Proceed to Phase 2B (Research Agent Worker)" -ForegroundColor Cyan
Write-Host ""
