#!/usr/bin/env pwsh
<#
.SYNOPSIS
CEAN Phase 2A - D1 Database Setup Automation Script

.DESCRIPTION
Interactively guides through D1 database creation for "bas-metadata" and updates wrangler.toml.
Includes prerequisite checks and deployment verification.

.USAGE
.\setup-d1.ps1

.NOTES
Requires:
- PowerShell 7+
- Cloudflare API token in .env
- wrangler CLI installed
#>

param(
    [switch]$SkipChecks,
    [switch]$AutoDeploy,
    [string]$DatabaseId
)

# Color definitions
$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-Header($Message) {
    Write-Host "`n" -ForegroundColor $Colors.Header
    Write-Host "═══════════════════════════════════════" -ForegroundColor $Colors.Header
    Write-Host "  $Message" -ForegroundColor $Colors.Header
    Write-Host "═══════════════════════════════════════" -ForegroundColor $Colors.Header
}

function Write-Success($Message) {
    Write-Host "✅ $Message" -ForegroundColor $Colors.Success
}

function Write-Error-Custom($Message) {
    Write-Host "❌ $Message" -ForegroundColor $Colors.Error
}

function Write-Warning-Custom($Message) {
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Warning
}

function Write-Info($Message) {
    Write-Host "ℹ️  $Message" -ForegroundColor $Colors.Info
}

# ─────────────────────────────────────────────────────────
# STEP 0: Prerequisites Check
# ─────────────────────────────────────────────────────────

Write-Header "CEAN Phase 2A: D1 Database Setup"

if (-not $SkipChecks) {
    Write-Host "`n📋 Checking Prerequisites..." -ForegroundColor $Colors.Info
    
    $checks_passed = $true
    
    # Check 1: Current directory
    if ((Get-Location).Path -ne "f:\mcp-brunella-core") {
        Write-Warning-Custom "Current directory is not f:\mcp-brunella-core"
        Write-Info "Changing directory..."
        Set-Location "f:\mcp-brunella-core"
    }
    Write-Success "Location: $(Get-Location)"
    
    # Check 2: .env file
    if (Test-Path ".env") {
        Write-Success ".env file found"
        $env_content = Get-Content ".env" -Raw
        
        if ($env_content -like "*CLOUDFLARE_API_TOKEN*") {
            Write-Success "CLOUDFLARE_API_TOKEN found in .env"
        } else {
            Write-Error-Custom "CLOUDFLARE_API_TOKEN not found in .env"
            $checks_passed = $false
        }
        
        if ($env_content -like "*CLOUDFLARE_ACCOUNT_ID*") {
            Write-Success "CLOUDFLARE_ACCOUNT_ID found in .env"
        } else {
            Write-Error-Custom "CLOUDFLARE_ACCOUNT_ID not found in .env"
            $checks_passed = $false
        }
    } else {
        Write-Error-Custom ".env file not found"
        $checks_passed = $false
    }
    
    # Check 3: wrangler CLI
    $wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
    if ($wrangler) {
        Write-Success "wrangler CLI installed: $($wrangler.Version)"
    } else {
        Write-Error-Custom "wrangler CLI not found. Install: npm install -g wrangler"
        $checks_passed = $false
    }
    
    # Check 4: Node.js
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        Write-Success "Node.js installed"
    } else {
        Write-Error-Custom "Node.js not found"
        $checks_passed = $false
    }
    
    # Check 5: wrangler.toml exists
    $wrangler_path = "myai/agents/workers/cean-test/wrangler.toml"
    if (Test-Path $wrangler_path) {
        Write-Success "wrangler.toml found"
    } else {
        Write-Error-Custom "wrangler.toml not found at $wrangler_path"
        $checks_passed = $false
    }
    
    if (-not $checks_passed) {
        Write-Error-Custom "`nPrerequisites check failed. Fix errors above and retry."
        exit 1
    }
    
    Write-Success "`n✅ All prerequisites passed!"
}

# ─────────────────────────────────────────────────────────
# STEP 1: D1 Database ID Input
# ─────────────────────────────────────────────────────────

Write-Header "STEP 1: Database ID"

if ($DatabaseId) {
    Write-Info "Using provided Database ID: $DatabaseId"
    $db_id = $DatabaseId
} else {
    Write-Host "`n📌 To get your Database ID:" -ForegroundColor $Colors.Info
    Write-Host "  1. Go to: https://dash.cloudflare.com/"
    Write-Host "  2. Navigate: Workers & Pages → D1"
    Write-Host "  3. Create 'bas-metadata' database (if not exists)"
    Write-Host "  4. Copy Database ID (format: d1_xxxxxxxxxxxxx)`n"
    
    $db_id = Read-Host "Enter Database ID (d1_xxxxx...)"
    
    if ($db_id -notmatch "^d1_[a-zA-Z0-9]+$") {
        Write-Error-Custom "Invalid Database ID format. Should start with 'd1_'"
        exit 1
    }
}

Write-Success "Database ID accepted: $db_id"

# ─────────────────────────────────────────────────────────
# STEP 2: Update wrangler.toml
# ─────────────────────────────────────────────────────────

Write-Header "STEP 2: Update wrangler.toml"

$wrangler_path = "myai/agents/workers/cean-test/wrangler.toml"
$wrangler_content = Get-Content $wrangler_path -Raw

# Check if D1 binding already exists
if ($wrangler_content -like "*[[d1_databases]]*") {
    Write-Warning-Custom "D1 binding already exists in wrangler.toml"
    $response = Read-Host "Replace existing binding? (y/n)"
    if ($response -ne "y") {
        Write-Info "Skipping wrangler.toml update"
    } else {
        # Remove old binding
        $wrangler_content = $wrangler_content -replace "`n\[\[d1_databases\]\].*?database_id = `"d1_[^`"]*`"", ""
        
        # Add new binding
        $new_binding = @"

# D1 Database Binding (Phase 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "$db_id"
"@
        
        $wrangler_content += $new_binding
        Set-Content -Path $wrangler_path -Value $wrangler_content -Encoding UTF8
        Write-Success "wrangler.toml updated with new Database ID"
    }
} else {
    # Add new binding
    $new_binding = @"

# D1 Database Binding (Phase 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "$db_id"
"@
    
    $wrangler_content += $new_binding
    Set-Content -Path $wrangler_path -Value $wrangler_content -Encoding UTF8
    Write-Success "D1 binding added to wrangler.toml"
}

# ─────────────────────────────────────────────────────────
# STEP 3: Build Worker
# ─────────────────────────────────────────────────────────

Write-Header "STEP 3: Build Worker"

Set-Location "myai/agents/workers/cean-test"

Write-Info "Building worker..."
npm run build 2>&1 | Out-String | ForEach-Object {
    if ($_ -like "*error*") {
        Write-Error-Custom $_
    } elseif ($_ -like "*worker.js*") {
        Write-Success $_
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Success "Worker built successfully"
} else {
    Write-Error-Custom "Build failed. Check errors above."
    exit 1
}

# ─────────────────────────────────────────────────────────
# STEP 4: Deploy Worker
# ─────────────────────────────────────────────────────────

Write-Header "STEP 4: Deploy Worker"

if (-not $AutoDeploy) {
    $deploy_confirm = Read-Host "Deploy to production? (y/n)"
    if ($deploy_confirm -ne "y") {
        Write-Info "Deployment skipped. Run 'wrangler deploy --env production' manually."
        exit 0
    }
}

Write-Info "Deploying worker with D1 binding..."
wrangler deploy --env production 2>&1 | Out-String | ForEach-Object {
    if ($_ -like "*error*" -or $_ -like "*failed*") {
        Write-Error-Custom $_
    } elseif ($_ -like "*https://*") {
        Write-Success $_
    } else {
        Write-Host $_
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Success "Worker deployed successfully!"
    $worker_url = "https://cean-test.peterpohankapersonal.workers.dev"
} else {
    Write-Error-Custom "Deployment failed. Check errors above."
    exit 1
}

# ─────────────────────────────────────────────────────────
# STEP 5: Test D1 Connectivity
# ─────────────────────────────────────────────────────────

Write-Header "STEP 5: Test D1 Connectivity"

Set-Location "f:\mcp-brunella-core"

Write-Info "Testing /test/d1 endpoint..."
Start-Sleep -Seconds 2  # Wait for worker to be ready

$test_body = @{ action = "check" } | ConvertTo-Json

try {
    $response = Invoke-WebRequest `
        -Uri "$worker_url/test/d1" `
        -Method POST `
        -Body $test_body `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    $response_data = $response.Content | ConvertFrom-Json
    
    if ($response_data.success -eq $true) {
        Write-Success "✅ D1 Database is responsive!"
        Write-Success "Response: $($response_data.message)"
    } else {
        Write-Warning-Custom "D1 test returned: $($response_data.error)"
        Write-Info "Instructions: $($response_data.message)"
    }
} catch {
    Write-Error-Custom "Failed to connect to worker: $_"
    Write-Info "The worker may still be initializing. Wait 30 seconds and retry manually."
}

# ─────────────────────────────────────────────────────────
# STEP 6: Summary
# ─────────────────────────────────────────────────────────

Write-Header "Setup Complete! ✅"

Write-Host @"

📊 Summary:
  - Database ID: $db_id
  - wrangler.toml: Updated ✅
  - Worker: Deployed ✅
  - Worker URL: $worker_url
  
🧪 Test D1:
  PowerShell:
    `$body = @{ action = 'check' } | ConvertTo-Json
    Invoke-WebRequest "$worker_url/test/d1" -Method POST -Body `$body -ContentType 'application/json'

🎯 Next Steps:
  1. Verify /test/d1 returns success: true
  2. Test table creation: action='create_table'
  3. Test data insertion: action='insert'
  4. Move to Phase 2B (Research Agent Worker)

📖 Documentation:
  - docs/CEAN_D1_SETUP_INTERACTIVE.md
  - docs/CEAN_PHASE_2A_D1_SETUP.md

"@ -ForegroundColor $Colors.Success

Write-Success "`n🚀 Enjoy your new D1 database!"
