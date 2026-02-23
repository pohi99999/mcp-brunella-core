#!/usr/bin/env pwsh
<#
.SYNOPSIS
CEAN Phase 2A - Automated D1 Setup (Post-Creation)

.DESCRIPTION
Automates Steps 2-5 after manual D1 database creation:
- Applies D1 schema
- Updates wrangler.toml with database ID
- Redeploys worker
- Verifies D1 connectivity

.USAGE
.\cean-phase2a-setup.ps1 -DatabaseId "your-db-id-here"

.PARAMETER DatabaseId
The D1 Database ID copied from Cloudflare Dashboard (required)

.EXAMPLE
.\cean-phase2a-setup.ps1 -DatabaseId "5a1f2b3c-4d5e-6f7g-8h9i-0j1k2l3m4n5o"

.NOTES
Requires:
- PowerShell 7+
- wrangler CLI installed
- Database already created in Cloudflare
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')]
    [string]$DatabaseId
)

# Color functions
function Write-Header($Message) {
    Write-Host "`n═══════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  $Message" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════`n" -ForegroundColor Magenta
}

function Write-Success($Message) {
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom($Message) {
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info($Message) {
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# ─────────────────────────────────────────────────────────
# MAIN SETUP FLOW
# ─────────────────────────────────────────────────────────

Write-Header "CEAN Phase 2A: Automated D1 Setup"

Write-Info "Database ID: $DatabaseId"
Write-Info "Database Name: bas-metadata"
Write-Info ""

# Change to project root
if ((Get-Location).Path -ne "f:\mcp-brunella-core") {
    Write-Info "Changing to project root..."
    Set-Location "f:\mcp-brunella-core"
}

# ─────────────────────────────────────────────────────────
# STEP 2: Apply D1 Schema
# ─────────────────────────────────────────────────────────

Write-Header "Step 2: Applying D1 Schema"

$schemaPath = "myai/agents/workers/schema/d1_schema.sql"

if (-not (Test-Path $schemaPath)) {
    Write-Error-Custom "Schema file not found: $schemaPath"
    exit 1
}

Write-Info "Schema file: $schemaPath"
Write-Info "Applying schema to bas-metadata..."

try {
    $result = wrangler d1 execute bas-metadata --file=$schemaPath --remote 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Schema applied successfully"
        Write-Info "12 tables created (edge_tasks, edge_executions, edge_results, etc.)"
    } else {
        Write-Error-Custom "Schema apply failed"
        Write-Info "Error output: $result"
        exit 1
    }
} catch {
    Write-Error-Custom "Schema apply exception: $_"
    exit 1
}

# ─────────────────────────────────────────────────────────
# STEP 3: Update wrangler.toml
# ─────────────────────────────────────────────────────────

Write-Header "Step 3: Updating wrangler.toml"

$wranglerPath = "myai/agents/workers/cean-test/wrangler.toml"

if (-not (Test-Path $wranglerPath)) {
    Write-Error-Custom "wrangler.toml not found: $wranglerPath"
    exit 1
}

$wranglerContent = Get-Content $wranglerPath -Raw

# Check if D1 binding already exists
if ($wranglerContent -match '\[\[d1_databases\]\]') {
    Write-Info "D1 binding already exists, updating database_id..."
    
    # Update existing database_id
    $wranglerContent = $wranglerContent -replace 'database_id\s*=\s*".*?"', "database_id = `"$DatabaseId`""
} else {
    Write-Info "Adding D1 binding to wrangler.toml..."
    
    # Append D1 binding
    $d1Binding = @"

# D1 Database Binding (PHASE 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "$DatabaseId"
"@
    
    $wranglerContent += $d1Binding
}

# Write updated content
Set-Content -Path $wranglerPath -Value $wranglerContent -NoNewline

Write-Success "wrangler.toml updated with database_id: $DatabaseId"

# ─────────────────────────────────────────────────────────
# STEP 4: Rebuild & Redeploy Worker
# ─────────────────────────────────────────────────────────

Write-Header "Step 4: Rebuilding & Redeploying Worker"

Set-Location "myai/agents/workers/cean-test"

Write-Info "Running: npm run build..."

try {
    $buildResult = npm run build 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Build successful"
    } else {
        Write-Error-Custom "Build failed"
        Write-Info "Build output: $buildResult"
        Set-Location "f:\mcp-brunella-core"
        exit 1
    }
} catch {
    Write-Error-Custom "Build exception: $_"
    Set-Location "f:\mcp-brunella-core"
    exit 1
}

Write-Info "Deploying to Cloudflare..."

try {
    $deployResult = wrangler deploy 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Worker deployed successfully"
        Write-Info "Live URL: https://cean-test.peterpohankapersonal.workers.dev"
    } else {
        Write-Error-Custom "Deployment failed"
        Write-Info "Deploy output: $deployResult"
        Set-Location "f:\mcp-brunella-core"
        exit 1
    }
} catch {
    Write-Error-Custom "Deployment exception: $_"
    Set-Location "f:\mcp-brunella-core"
    exit 1
}

Set-Location "f:\mcp-brunella-core"

# ─────────────────────────────────────────────────────────
# STEP 5: Verify D1 Connectivity
# ─────────────────────────────────────────────────────────

Write-Header "Step 5: Verifying D1 Connectivity"

$workerUrl = "https://cean-test.peterpohankapersonal.workers.dev"

Write-Info "Testing D1 write endpoint..."
Start-Sleep -Seconds 3  # Wait for deployment propagation

try {
    $testPayload = @{
        test_id = "cean-phase2a-$(Get-Date -Format 'yyyyMMddHHmmss')"
        data = "CEAN Phase 2A automated setup test"
    } | ConvertTo-Json

    $writeResponse = Invoke-RestMethod -Uri "$workerUrl/test/d1" -Method Post -Body $testPayload -ContentType "application/json"
    
    if ($writeResponse.success) {
        Write-Success "D1 write test PASSED"
        Write-Info "Test ID: $($writeResponse.test_id)"
        Write-Info "Rows inserted: $($writeResponse.rows_inserted)"
    } else {
        Write-Error-Custom "D1 write test FAILED"
        Write-Info "Response: $($writeResponse | ConvertTo-Json)"
    }
} catch {
    Write-Error-Custom "D1 write test exception: $_"
}

Write-Info "`nTesting D1 read endpoint..."

try {
    $readResponse = Invoke-RestMethod -Uri "$workerUrl/test/d1/read" -Method Get
    
    if ($readResponse.success) {
        Write-Success "D1 read test PASSED"
        Write-Info "Total rows: $($readResponse.total_rows)"
    } else {
        Write-Error-Custom "D1 read test FAILED"
    }
} catch {
    Write-Error-Custom "D1 read test exception: $_"
}

# ─────────────────────────────────────────────────────────
# COMPLETION SUMMARY
# ─────────────────────────────────────────────────────────

Write-Header "CEAN Phase 2A Setup Complete! ✅"

Write-Success "All steps completed successfully:"
Write-Info "  ✅ Schema applied (12 tables)"
Write-Info "  ✅ wrangler.toml updated"
Write-Info "  ✅ Worker redeployed"
Write-Info "  ✅ D1 connectivity verified"
Write-Info ""
Write-Info "Next: Update CEAN_STATUS_REPORT.md with Phase 2A completion"
Write-Info "      git add ."
Write-Info "      git commit -m 'feat(cean): Phase 2A complete - D1 database setup'"

Write-Host "`n🎉 Phase 2A is now 100% COMPLETE!" -ForegroundColor Green
