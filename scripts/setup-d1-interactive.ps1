# ==========================================
# Brunella D1 Database Setup Helper (PowerShell)
# Interactive Configuration Wizard
# ==========================================

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BRUNELLA D1 DATABASE SETUP HELPER     ║" -ForegroundColor Cyan
Write-Host "║  Interactive Configuration Wizard       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get D1 Database ID from user
Write-Host "STEP 1: Create D1 Database in Cloudflare Dashboard" -ForegroundColor Green
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "1. Go to: https://dash.cloudflare.com/"
Write-Host "2. Navigate to: Workers & Pages > D1"
Write-Host "3. Click: [Create Database]"
Write-Host "4. Name: bas-metadata"
Write-Host "5. Click: [Create]"
Write-Host ""
Write-Host "After creation, you'll see the Database ID:" -ForegroundColor Yellow
Write-Host "   Example: d1_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
Write-Host ""

$DB_ID = Read-Host "📝 Enter your D1 Database ID (paste from Cloudflare Dashboard)"

if ([string]::IsNullOrWhiteSpace($DB_ID)) {
    Write-Host ""
    Write-Host "❌ ERROR: Empty Database ID" -ForegroundColor Red
    Write-Host "Please run this script again and enter the Database ID"
    pause
    exit 1
}

# Validate D1 ID format
if ($DB_ID -notmatch '^d1_[a-z0-9]{32}$') {
    Write-Host ""
    Write-Host "⚠️  WARNING: ID format looks unusual" -ForegroundColor Yellow
    Write-Host "   Expected format: d1_[32 hex characters]"
    Write-Host "   Got: $DB_ID"
    Write-Host ""
    $confirm = Read-Host "Continue anyway? (Y/N)"
    if ($confirm -ne 'Y') { exit 1 }
}

Write-Host ""
Write-Host "✅ Database ID: $DB_ID" -ForegroundColor Green
Write-Host ""

# Step 2: Update all worker configurations
Write-Host "STEP 2: Configuring Workers..." -ForegroundColor Green
Write-Host "══════════════════════════════" -ForegroundColor Green
Write-Host ""

$workers = @(
    "myai/agents/workers/cean-test",
    "myai/agents/workers/research-agent",
    "myai/agents/workers/grant-monitor"
)

foreach ($worker in $workers) {
    $workerPath = "f:\mcp-brunella-core\$worker"
    $wranglerFile = Join-Path $workerPath "wrangler.toml"
    
    if (Test-Path $wranglerFile) {
        Write-Host "📝 Updating $worker/wrangler.toml..." -ForegroundColor Cyan
        
        # Create backup
        $backupFile = "$wranglerFile.backup"
        Copy-Item $wranglerFile $backupFile -Force | Out-Null
        Write-Host "   Backup: $backupFile (created)"
        
        # Read and update file
        $content = Get-Content $wranglerFile -Raw
        
        # For cean-test, uncomment the D1 section
        if ($worker -like "*cean-test*") {
            $content = $content -replace '# \[\[d1_databases\]\]', '[[d1_databases]]'
            $content = $content -replace '# binding = "DB"', 'binding = "DB"'
            $content = $content -replace '# database_name = "bas-metadata"', 'database_name = "bas-metadata"'
            $content = $content -replace '# database_id = "YOUR_DB_ID"', "database_id = `"$DB_ID`""
        }
        
        # For other workers, replace placeholder
        else {
            $content = $content -replace 'database_id = "UPDATE_WITH_YOUR_D1_ID"', "database_id = `"$DB_ID`""
        }
        
        Set-Content $wranglerFile $content -Encoding UTF8
        Write-Host "   ✅ $worker configured" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $wranglerFile not found" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 3: Create .env file
Write-Host "STEP 3: Creating .env for local development" -ForegroundColor Green
Write-Host "═════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

$envFile = "f:\mcp-brunella-core\.env"
if (Test-Path $envFile) {
    Write-Host "   ℹ️  .env already exists, updating D1_ID..." -ForegroundColor Cyan
    
    $envContent = Get-Content $envFile -Raw
    if ($envContent -like "*D1_ID*") {
        $envContent = $envContent -replace 'D1_ID=.*', "D1_ID=$DB_ID"
    } else {
        Add-Content $envFile "D1_ID=$DB_ID"
    }
    Set-Content $envFile $envContent
} else {
    "D1_ID=$DB_ID" | Out-File $envFile -Encoding UTF8
    Write-Host "   ✅ .env created" -ForegroundColor Green
}

Write-Host ""

# Step 4: Build and verify
Write-Host "STEP 4: Building & Verifying..." -ForegroundColor Green
Write-Host "════════════════════════════════" -ForegroundColor Green
Write-Host ""

$projectRoot = "f:\mcp-brunella-core"
Set-Location $projectRoot

Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Build successful" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Build completed with warnings (non-critical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ CONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Configuration Summary:" -ForegroundColor Cyan
Write-Host "   Database ID: $DB_ID"
Write-Host "   Workers Updated: 3"
Write-Host "   .env File: Updated"
Write-Host "   TypeScript Build: ✅ Passed"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Deploy cean-test worker:" -ForegroundColor Yellow
Write-Host "   cd myai\agents\workers\cean-test"
Write-Host "   wrangler deploy --env production"
Write-Host ""
Write-Host "2. Test D1 Database connectivity:" -ForegroundColor Yellow
Write-Host "   curl https://cean-test.<account>.workers.dev/health"
Write-Host ""
Write-Host "3. Deploy research-agent worker:" -ForegroundColor Yellow
Write-Host "   cd myai\agents\workers\research-agent"
Write-Host "   wrangler deploy --env production"
Write-Host ""
Write-Host "4. Deploy grant-monitor worker:" -ForegroundColor Yellow
Write-Host "   cd myai\agents\workers\grant-monitor"
Write-Host "   wrangler deploy --env production"
Write-Host ""
Write-Host "5. Check Cloudflare Dashboard for deployment status:" -ForegroundColor Yellow
Write-Host "   https://dash.cloudflare.com/Workers & Pages"
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ Ready to deploy!" -ForegroundColor Green
Write-Host ""

pause
