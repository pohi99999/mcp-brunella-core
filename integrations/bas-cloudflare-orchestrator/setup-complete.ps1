# ============================================================
# BAS (Brunella Agent System) - Complete Setup Script
# Hybrid Architecture: Cloudflare + Langflow + n8n + Browser-Use
# ============================================================

param(
    [switch]$SkipCloudflare,
    [switch]$SkipLangflow,
    [switch]$SkipBrowserUse,
    [switch]$SkipN8n
)

$ErrorActionPreference = "Continue"
$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

# Colors
function Write-Step { param($msg) Write-Host "`n🔷 $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   ✅ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "   ⚠️ $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "   ❌ $msg" -ForegroundColor Red }

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║     🤖 BAS - Brunella Agent System Setup                     ║
║     Hybrid Multi-Agent Architecture                          ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# ============================================================
# 1. Prerequisites Check
# ============================================================
Write-Step "Checking prerequisites..."

# Node.js
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Success "Node.js $nodeVersion"
} else {
    Write-Error "Node.js not found! Install from https://nodejs.org"
}

# Python
$pythonVersion = python --version 2>$null
if ($pythonVersion) {
    Write-Success "Python $pythonVersion"
} else {
    Write-Error "Python not found!"
}

# Ollama
$ollamaRunning = Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue
if ($ollamaRunning.TcpTestSucceeded) {
    Write-Success "Ollama running on port 11434"
} else {
    Write-Warning "Ollama not running. Start with: ollama serve"
}

# Wrangler (Cloudflare CLI)
$wranglerVersion = wrangler --version 2>$null
if ($wranglerVersion) {
    Write-Success "Wrangler CLI installed"
} else {
    Write-Warning "Wrangler not found. Installing globally..."
    npm install -g wrangler
}

# ============================================================
# 2. Project Structure
# ============================================================
Write-Step "Setting up project structure..."

$dirs = @(
    "$ProjectRoot\src",
    "$ProjectRoot\local",
    "$ProjectRoot\langflow",
    "$ProjectRoot\n8n",
    "$ProjectRoot\client"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Created $dir"
    }
}

# ============================================================
# 3. Cloudflare Worker Setup
# ============================================================
if (-not $SkipCloudflare) {
    Write-Step "Setting up Cloudflare Worker..."
    
    Set-Location $ProjectRoot
    
    if (Test-Path "package.json") {
        Write-Host "   Installing npm dependencies..."
        npm install 2>$null
        Write-Success "Dependencies installed"
        
        Write-Host "`n   📋 Manual steps required:"
        Write-Host "   1. Run: npm run kv:create" -ForegroundColor Yellow
        Write-Host "   2. Copy the KV ID to wrangler.jsonc" -ForegroundColor Yellow
        Write-Host "   3. Run: npm run deploy" -ForegroundColor Yellow
    }
}

# ============================================================
# 4. Browser-Use API Setup
# ============================================================
if (-not $SkipBrowserUse) {
    Write-Step "Setting up Browser-Use API (robotkéz)..."
    
    $localDir = "$ProjectRoot\local"
    Set-Location $localDir
    
    if (-not (Test-Path "venv")) {
        Write-Host "   Creating Python virtual environment..."
        python -m venv venv
        Write-Success "Virtual environment created"
    }
    
    Write-Host "`n   📋 To start Browser-Use API:"
    Write-Host "   cd $localDir" -ForegroundColor Yellow
    Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "   pip install -r requirements.txt" -ForegroundColor Yellow
    Write-Host "   python browser_use_api.py" -ForegroundColor Yellow
}

# ============================================================
# 5. Langflow Setup
# ============================================================
if (-not $SkipLangflow) {
    Write-Step "Setting up Langflow..."
    
    $langflowRunning = Test-NetConnection -ComputerName localhost -Port 7860 -WarningAction SilentlyContinue
    if ($langflowRunning.TcpTestSucceeded) {
        Write-Success "Langflow already running on port 7860"
    } else {
        Write-Host "`n   📋 To install and start Langflow:"
        Write-Host "   pip install langflow" -ForegroundColor Yellow
        Write-Host "   langflow run --host 0.0.0.0 --port 7860" -ForegroundColor Yellow
    }
    
    Write-Host "`n   📋 Import these flows into Langflow:"
    Write-Host "   • $ProjectRoot\langflow\bas-research-agent.json" -ForegroundColor Cyan
    Write-Host "   • $ProjectRoot\langflow\bas-orchestrator-agent.json" -ForegroundColor Cyan
}

# ============================================================
# 6. n8n Setup
# ============================================================
if (-not $SkipN8n) {
    Write-Step "Setting up n8n workflow..."
    
    $n8nRunning = Test-NetConnection -ComputerName localhost -Port 5678 -WarningAction SilentlyContinue
    if ($n8nRunning.TcpTestSucceeded) {
        Write-Success "n8n already running on port 5678"
    } else {
        Write-Host "`n   📋 To start n8n:"
        Write-Host "   npx n8n" -ForegroundColor Yellow
        Write-Host "   OR with Docker:" -ForegroundColor Gray
        Write-Host "   docker run -p 5678:5678 n8nio/n8n" -ForegroundColor Gray
    }
    
    Write-Host "`n   📋 Import this workflow into n8n:"
    Write-Host "   • $ProjectRoot\n8n\bas-task-handler.json" -ForegroundColor Cyan
}

# ============================================================
# 7. Python Client Setup
# ============================================================
Write-Step "Setting up Python client..."

$clientDir = "$ProjectRoot\client"
$clientReqs = @"
httpx>=0.26.0
asyncio
"@

Set-Content -Path "$clientDir\requirements.txt" -Value $clientReqs
Write-Success "Client requirements.txt created"

# ============================================================
# Summary
# ============================================================
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                    🎉 Setup Complete!                        ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host @"
📊 Component Status:
"@

# Check all components
$components = @{
    "Ollama (11434)" = (Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue).TcpTestSucceeded
    "Langflow (7860)" = (Test-NetConnection -ComputerName localhost -Port 7860 -WarningAction SilentlyContinue).TcpTestSucceeded
    "Browser-Use (8000)" = (Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded
    "n8n (5678)" = (Test-NetConnection -ComputerName localhost -Port 5678 -WarningAction SilentlyContinue).TcpTestSucceeded
}

foreach ($comp in $components.GetEnumerator()) {
    $status = if ($comp.Value) { "✅ Running" } else { "⏸️ Not running" }
    Write-Host "   $($comp.Key): $status"
}

Write-Host @"

🚀 Quick Start Commands:

# 1. Deploy Cloudflare Worker
cd $ProjectRoot
npm run kv:create  # Copy ID to wrangler.jsonc
npm run deploy

# 2. Start Browser-Use API
cd $ProjectRoot\local
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python browser_use_api.py

# 3. Start Langflow
langflow run --port 7860

# 4. Start n8n
npx n8n

# 5. Test the system
curl -X POST https://bas-orchestrator.workers.dev/task `
  -H "Content-Type: application/json" `
  -d '{"instruction": "Test task"}'

"@ -ForegroundColor Cyan

Set-Location $ProjectRoot
