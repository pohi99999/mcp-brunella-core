<#
.SYNOPSIS
CEAN Phase 2A - D1 Database Setup (Simple)

.DESCRIPTION
Simple automation for D1 database creation via Cloudflare API

.USAGE
.\setup-d1-simple.ps1
#>

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

Write-Host "
╔════════════════════════════════════════════════════╗
║   CEAN Phase 2A - D1 Database Setup (Simple)      ║
╚════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Check prerequisites
Write-Host "✓ Checking prerequisites..." -ForegroundColor Green

if (-not $ApiToken) {
    Write-Host "❌ CLOUDFLARE_API_TOKEN not found" -ForegroundColor Red
    exit 1
}

if (-not $AccountId) {
    Write-Host "❌ CLOUDFLARE_ACCOUNT_ID not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ProjectRoot)) {
    Write-Host "❌ Project root not found" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Prerequisites OK" -ForegroundColor Green

# Step 1: Test API auth
Write-Host "`n[1/4] Testing Cloudflare API authentication..." -ForegroundColor Cyan

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
    
    Write-Host "✓ API authentication successful" -ForegroundColor Green
} catch {
    Write-Host "⚠ API connection failed: $_" -ForegroundColor Yellow
    Write-Host "Falling back to manual D1 creation..." -ForegroundColor Yellow
}

# Step 2: Create D1 database
Write-Host "`n[2/4] Creating D1 database '$($Config.DatabaseName)'..." -ForegroundColor Cyan

try {
    $body = @{ name = $Config.DatabaseName } | ConvertTo-Json
    
    $response = Invoke-WebRequest `
        -Uri "$($Config.ApiBase)/accounts/$AccountId/d1/database" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 10
    
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success -and $data.result) {
        $dbId = $data.result.id
        Write-Host "✓ D1 database created: $dbId" -ForegroundColor Green
    } else {
        throw "API error: $($data.errors[0].message)"
    }
} catch {
    Write-Host "⚠ Automatic creation failed: $_" -ForegroundColor Yellow
    Write-Host "`nManual D1 Creation Required:
1. Go to: https://dash.cloudflare.com/
2. Workers & Pages → D1
3. Create Database → Name: '$($Config.DatabaseName)'
4. Copy the Database ID (d1_xxxxx...)
" -ForegroundColor Yellow
    
    $dbId = Read-Host "Enter Database ID"
    
    if (-not ($dbId -match "^d1_[a-zA-Z0-9]+$")) {
        Write-Host "❌ Invalid Database ID format" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Using Database ID: $dbId" -ForegroundColor Green
}

# Step 3: Update wrangler.toml
Write-Host "`n[3/4] Updating wrangler.toml..." -ForegroundColor Cyan

try {
    $content = Get-Content $Config.WranglerConfig -Raw
    
    # Remove existing D1 binding
    $content = $content -replace "`n\[\[d1_databases\]\].*?database_id = `"d1_[^`"]*`"" -replace "`r`n", "`n"
    
    # Add new binding
    $newBinding = "`n`n# D1 Database Binding (Phase 2A)`n[[d1_databases]]`nbinding = `"$($Config.BindingName)`"`ndatabase_name = `"$($Config.DatabaseName)`"`ndatabase_id = `"$dbId`n"
    $content += $newBinding
    
    Set-Content -Path $Config.WranglerConfig -Value $content -Encoding UTF8 -NoNewline
    Write-Host "✓ wrangler.toml updated" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to update wrangler.toml: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Build & Deploy
Write-Host "`n[4/4] Building and deploying worker..." -ForegroundColor Cyan

try {
    Push-Location $Config.WorkerPath
    
    Write-Host "  Building..." -ForegroundColor Gray
    npm run build | Out-Null
    
    Write-Host "  Deploying..." -ForegroundColor Gray
    wrangler deploy --env production | Out-Null
    
    Pop-Location
    Write-Host "✓ Worker deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build/deploy failed: $_" -ForegroundColor Red
    if ($PSItem.InvocationInfo.MyCommand.Name) {
        Pop-Location
    }
    exit 1
}

# Summary
Write-Host "
════════════════════════════════════════════════════
  ✅ PHASE 2A D1 SETUP COMPLETE
════════════════════════════════════════════════════

Database ID: $dbId
Worker URL: https://cean-test.peterpohankapersonal.workers.dev

Next: Test /test/d1 endpoint
  curl -X POST https://cean-test.peterpohankapersonal.workers.dev/test/d1 \
    -H 'Content-Type: application/json' \
    -d '{\"action\":\"check\"}'

Then: Proceed to Phase 2B (Research Agent Worker)
" -ForegroundColor Green
