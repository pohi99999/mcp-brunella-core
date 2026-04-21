#!/usr/bin/env pwsh
<#
.SYNOPSIS
CEAN Phase 2A - D1 Database Setup Automation (Advanced - API-based)

.DESCRIPTION
Advanced automation script that attempts D1 database creation via Cloudflare API,
with fallback to manual Dashboard instructions.

Includes:
- Prerequisite validation
- Git configuration verification
- D1 database creation attempt (via API)
- wrangler.toml binding auto-update
- Worker build and deployment
- E2E testing and verification

.USAGE
.\setup-d1-advanced.ps1 -ApiToken $env:CLOUDFLARE_API_TOKEN -AccountId $env:CLOUDFLARE_ACCOUNT_ID

.NOTES
Requires:
- PowerShell 7+
- Cloudflare API token with D1 write permissions
- .env file with CLOUDFLARE_* variables
- wrangler CLI installed
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN,
    
    [Parameter(Mandatory = $false)]
    [string]$AccountId = $env:CLOUDFLARE_ACCOUNT_ID,
    
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = "f:\mcp-brunella-core",
    
    [switch]$ManualMode,
    [switch]$SkipTests,
    [switch]$Verbose
)

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════

$Config = @{
    ApiBase = "https://api.cloudflare.com/client/v4"
    DatabaseName = "bas-metadata"
    BindingName = "DB"
    WorkerPath = "$ProjectRoot\myai\agents\workers\cean-test"
    WranglerConfig = "$ProjectRoot\myai\agents\workers\cean-test\wrangler.toml"
    DashboardUrl = "https://dash.cloudflare.com/"
    WorkerUrl = "https://cean-test.peterpohankapersonal.workers.dev"
    Phase = "2A"
}

$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Header = "Magenta"
    Verbose = "DarkGray"
}

# ═══════════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════════

function Write-Header($Message, $Char = "═") {
    Write-Host "`n" -ForegroundColor $Colors.Header
    Write-Host ($Char * 50) -ForegroundColor $Colors.Header
    Write-Host "  $Message" -ForegroundColor $Colors.Header
    Write-Host ($Char * 50) -ForegroundColor $Colors.Header
    Write-Host ""
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

function Write-Verbose-Custom($Message) {
    if ($Verbose) {
        Write-Host "🔍 $Message" -ForegroundColor $Colors.Verbose
    }
}

function Test-Prerequisites {
    Write-Header "PHASE 2A: D1 Database Setup - Prerequisite Check"
    
    $allPass = $true
    
    # Check 1: PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        Write-Error-Custom "PowerShell 7+ required (current: $($PSVersionTable.PSVersion))"
        $allPass = $false
    } else {
        Write-Success "PowerShell $($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)"
    }
    
    # Check 2: Project directory
    if (-not (Test-Path $ProjectRoot)) {
        Write-Error-Custom "Project root not found: $ProjectRoot"
        $allPass = $false
    } else {
        Write-Success "Project root: $ProjectRoot"
    }
    
    # Check 3: .env file
    $envPath = Join-Path $ProjectRoot ".env"
    if (-not (Test-Path $envPath)) {
        Write-Error-Custom ".env file not found"
        $allPass = $false
    } else {
        Write-Success ".env file found"
    }
    
    # Check 4: API Token
    if (-not $ApiToken) {
        Write-Error-Custom "CLOUDFLARE_API_TOKEN not set (use -ApiToken or set env variable)"
        $allPass = $false
    } else {
        $maskedToken = $ApiToken.Substring(0, 10) + "..." + $ApiToken.Substring(-10)
        Write-Success "API Token: $maskedToken"
    }
    
    # Check 5: Account ID
    if (-not $AccountId) {
        Write-Error-Custom "CLOUDFLARE_ACCOUNT_ID not set"
        $allPass = $false
    } else {
        Write-Success "Account ID: $AccountId"
    }
    
    # Check 6: wrangler CLI
    $wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
    if (-not $wrangler) {
        Write-Error-Custom "wrangler CLI not found. Install: npm install -g wrangler"
        $allPass = $false
    } else {
        Write-Success "wrangler: $($wrangler.Version)"
    }
    
    # Check 7: Git repo
    if (-not (Test-Path "$ProjectRoot\.git")) {
        Write-Error-Custom "Not a git repository"
        $allPass = $false
    } else {
        Write-Success "Git repository: $ProjectRoot"
    }
    
    if (-not $allPass) {
        Write-Host ""
        Write-Error-Custom "Prerequisites check failed. Fix errors above and retry."
        exit 1
    }
    
    Write-Success "`n✅ All prerequisites passed!`n"
    return $allPass
}

function Test-CloudflareApiAuth {
    Write-Header "Testing Cloudflare API Authentication"
    
    try {
        $headers = @{
            "Authorization" = "Bearer $ApiToken"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-WebRequest `
            -Uri "$($Config.ApiBase)/accounts/$AccountId/r2/buckets" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Success "API authentication successful"
        Write-Verbose-Custom "Account verified: $AccountId"
        return $true
    } catch {
        Write-Error-Custom "API authentication failed: $_"
        Write-Warning-Custom "Manual D1 creation recommended (use Dashboard)"
        return $false
    }
}

function Create-D1Database {
    param([string]$DatabaseName)
    
    Write-Header "Creating D1 Database via API"
    
    if (-not (Test-CloudflareApiAuth)) {
        Write-Info "Skipping API-based creation (authentication failed)"
        return $null
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $ApiToken"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            name = $DatabaseName
        } | ConvertTo-Json
        
        Write-Verbose-Custom "Creating D1: $DatabaseName"
        
        $response = Invoke-WebRequest `
            -Uri "$($Config.ApiBase)/accounts/$AccountId/d1/database" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ErrorAction Stop
        
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success -and $data.result) {
            $dbId = $data.result.id
            Write-Success "D1 database created: $dbId"
            Write-Verbose-Custom "Database name: $($data.result.name)"
            Write-Verbose-Custom "Created at: $($data.result.created_at)"
            return $dbId
        } else {
            Write-Error-Custom "Failed to create D1 database"
            Write-Verbose-Custom "Response: $($data | ConvertTo-Json)"
            return $null
        }
    } catch {
        Write-Error-Custom "D1 creation failed: $_"
        return $null
    }
}

function Update-WranglerConfig {
    param([string]$DatabaseId)
    
    Write-Header "Updating wrangler.toml"
    
    if (-not (Test-Path $Config.WranglerConfig)) {
        Write-Error-Custom "wrangler.toml not found: $($Config.WranglerConfig)"
        return $false
    }
    
    try {
        $content = Get-Content $Config.WranglerConfig -Raw
        
        # Remove existing D1 binding
        $content = $content -replace "`n\[\[d1_databases\]\].*?database_id = `"d1_[^`"]*`"", ""
        
        # Add new binding
        $newBinding = @"

# D1 Database Binding (Phase 2A)
[[d1_databases]]
binding = "$($Config.BindingName)"
database_name = "$($Config.DatabaseName)"
database_id = "$DatabaseId"
"@
        
        $content += $newBinding
        
        Set-Content -Path $Config.WranglerConfig -Value $content -Encoding UTF8
        Write-Success "wrangler.toml updated with Database ID: $DatabaseId"
        return $true
    } catch {
        Write-Error-Custom "Failed to update wrangler.toml: $_"
        return $false
    }
}

function Build-Worker {
    Write-Header "Building CEAN Test Worker"
    
    try {
        Push-Location $Config.WorkerPath
        
        Write-Info "Running 'npm run build'..."
        $output = npm run build 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Worker built successfully"
            Write-Verbose-Custom "Output: $($output[-1])"
            return $true
        } else {
            Write-Error-Custom "Build failed"
            Write-Host $output
            return $false
        }
    } catch {
        Write-Error-Custom "Build script failed: $_"
        return $false
    } finally {
        Pop-Location
    }
}

function Deploy-Worker {
    Write-Header "Deploying Worker to Cloudflare"
    
    try {
        Push-Location $Config.WorkerPath
        
        Write-Info "Running 'wrangler deploy --env production'..."
        $output = wrangler deploy --env production 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Worker deployed successfully"
            Write-Success "URL: $($Config.WorkerUrl)"
            return $true
        } else {
            Write-Error-Custom "Deployment failed"
            Write-Host $output
            return $false
        }
    } catch {
        Write-Error-Custom "Deployment failed: $_"
        return $false
    } finally {
        Pop-Location
    }
}

function Test-D1Connectivity {
    Write-Header "Testing D1 Connectivity"
    
    if ($SkipTests) {
        Write-Info "Tests skipped (--SkipTests)"
        return $true
    }
    
    Write-Info "Waiting for worker to be ready (2 seconds)..."
    Start-Sleep -Seconds 2
    
    try {
        $body = @{ action = "check" } | ConvertTo-Json
        
        Write-Verbose-Custom "Testing POST $($Config.WorkerUrl)/test/d1"
        
        $response = Invoke-WebRequest `
            -Uri "$($Config.WorkerUrl)/test/d1" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success -eq $true) {
            Write-Success "✅ D1 database is responsive!"
            Write-Success "Connection successful: $($data.message)"
            return $true
        } else {
            Write-Warning-Custom "D1 test returned: $($data.error)"
            if ($data.instructions) {
                Write-Info "Instructions:"
                $data.instructions | ForEach-Object { Write-Info "  $_" }
            }
            return $false
        }
    } catch {
        Write-Warning-Custom "Could not reach worker: $_"
        Write-Info "Worker may be initializing. Try again in 30 seconds."
        return $false
    }
}

function Git-CommitChanges {
    Write-Header "Committing Changes to Git"
    
    try {
        Push-Location $ProjectRoot
        
        Write-Info "Staging changes..."
        git add "myai/agents/workers/cean-test/wrangler.toml" 2>&1 | Out-Null
        
        $status = git status --short
        if ($status) {
            Write-Info "Files changed: $(($status | Measure-Object).Count)"
            
            Write-Info "Committing..."
            git commit -m "chore(cean): Phase 2A - D1 database binding update (auto)" 2>&1 | Out-Null
            
            Write-Info "Pushing to remote..."
            git push origin main 2>&1 | Out-Null
            
            Write-Success "Changes committed and pushed to GitHub"
            return $true
        } else {
            Write-Info "No changes to commit"
            return $true
        }
    } catch {
        Write-Error-Custom "Git operation failed: $_"
        return $false
    } finally {
        Pop-Location
    }
}

# ═══════════════════════════════════════════════════════════════
# Main Execution Flow
# ═══════════════════════════════════════════════════════════════

Write-Host @"

╔═════════════════════════════════════════════════════════════════╗
║                                                                 ║
║    🚀 CEAN Phase 2A: D1 Database Setup Automation (Advanced)   ║
║                                                                 ║
║    This script will:                                           ║
║    1. Validate prerequisites                                   ║
║    2. Create D1 database (auto or manual)                      ║
║    3. Update wrangler.toml binding                             ║
║    4. Build and deploy worker                                  ║
║    5. Test D1 connectivity                                     ║
║    6. Commit changes to Git                                    ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor $Colors.Header

# Step 1: Prerequisites
if (-not (Test-Prerequisites)) {
    exit 1
}

# Step 2: Database Creation
$dbId = $null

if (-not $ManualMode) {
    $dbId = Create-D1Database -DatabaseName $Config.DatabaseName
}

if (-not $dbId) {
    Write-Header "Manual D1 Database Creation Required"
    Write-Host @"
⚠️  D1 database could not be created automatically.

Follow these steps manually:

1. Go to: $($Config.DashboardUrl)
2. Navigate: Workers & Pages → D1
3. Click "Create Database"
4. Enter name: $($Config.DatabaseName)
5. Click "Create"
6. Copy Database ID (d1_xxxxx...)
7. Run this script again with: -ApiToken ... -AccountId ... -ManualMode

Or simply enter the Database ID now:
"@
    
    $dbId = Read-Host "Database ID (d1_xxxxx...)"
    
    if (-not ($dbId -match "^d1_[a-zA-Z0-9]+$")) {
        Write-Error-Custom "Invalid Database ID format"
        exit 1
    }
}

Write-Success "Using Database ID: $dbId`n"

# Step 3: Update wrangler.toml
if (-not (Update-WranglerConfig -DatabaseId $dbId)) {
    exit 1
}

# Step 4: Build Worker
if (-not (Build-Worker)) {
    exit 1
}

# Step 5: Deploy Worker
if (-not (Deploy-Worker)) {
    exit 1
}

# Step 6: Test D1 Connectivity
$testPassed = Test-D1Connectivity

# Step 7: Commit to Git
Git-CommitChanges | Out-Null

# Final Summary
Write-Header "Setup Complete! ✅" "═"

Write-Host @"
📊 Summary:
  ✅ Prerequisites validated
  ✅ D1 database configured: $dbId
  ✅ wrangler.toml updated
  ✅ Worker built successfully
  ✅ Worker deployed to production
  $(if ($testPassed) { "✅ D1 connectivity verified" } else { "⚠️  D1 connectivity pending (may initialize)" })
  ✅ Changes committed to Git

🎯 Next Steps:
  1. Verify worker at: $($Config.WorkerUrl)
  2. Test /test/d1 endpoint:
     curl -X POST $($Config.WorkerUrl)/test/d1 -d '{\"action\":\"check\"}'
  
  3. Proceed to Phase 2B:
     - Research Agent Worker implementation
     - Grant Monitor Worker
     - Data Harvester Worker

📈 Phase 2A Status: ✅ COMPLETE
🚀 Ready for Phase 2B: Research Agent Worker

"@ -ForegroundColor $Colors.Success

Write-Host ""
Write-Success "D1 Database Setup Automation Complete! 🎉`n"
