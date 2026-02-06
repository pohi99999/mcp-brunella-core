<# 
.SYNOPSIS
    BAS Frissítés Telepítő Script - ProjectConductor & Cloudflare Edge Integration
.DESCRIPTION
    Ez a script integrálja az új ügynököket és frissíti a Conductor fájlokat.
.NOTES
    Verzió: 1.0.0
    Szerző: Brunella Core Team
    Dátum: 2026-02-02
#>

param(
    [string]$ProjectRoot = "F:\mcp-brunella-core",
    [switch]$DryRun = $false,
    [switch]$SkipBackup = $false
)

# Színek
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[STEP] " -ForegroundColor $Cyan -NoNewline
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] " -ForegroundColor $Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] " -ForegroundColor $Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] " -ForegroundColor $Red -NoNewline
    Write-Host $Message
}

# Banner
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║     BAS Update Installer - ProjectConductor & Edge           ║
║                      Verzió 1.0.0                            ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Ellenőrzések
Write-Step "Projekt mappa ellenőrzése: $ProjectRoot"

if (-not (Test-Path $ProjectRoot)) {
    Write-Error "Projekt mappa nem található: $ProjectRoot"
    Write-Host "Használat: .\setup_bas_update.ps1 -ProjectRoot 'C:\path\to\mcp-brunella-core'"
    exit 1
}

$srcAgents = Join-Path $ProjectRoot "src\agents"
$conductor = Join-Path $ProjectRoot "conductor"

if (-not (Test-Path $srcAgents)) {
    Write-Error "src/agents mappa nem található"
    exit 1
}

Write-Success "Projekt mappa OK"

# Backup
if (-not $SkipBackup) {
    Write-Step "Backup készítése..."
    
    $backupDir = Join-Path $ProjectRoot "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Backup mappa: $backupDir"
    } else {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        
        # Kritikus fájlok mentése
        $filesToBackup = @(
            "src\agents\AgentManager.ts",
            "src\agents\registry.json",
            "conductor\tracks.md",
            "conductor\workflow.md",
            "conductor\SUMMARY.md"
        )
        
        foreach ($file in $filesToBackup) {
            $sourcePath = Join-Path $ProjectRoot $file
            if (Test-Path $sourcePath) {
                $destPath = Join-Path $backupDir $file
                $destDir = Split-Path $destPath -Parent
                if (-not (Test-Path $destDir)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
                Copy-Item $sourcePath $destPath
                Write-Host "  Backup: $file"
            }
        }
        
        Write-Success "Backup kész: $backupDir"
    }
}

# Új ügynökök telepítése
Write-Step "Új ügynökök telepítése..."

$agentFiles = @{
    "ProjectConductorAgent.ts" = @"
// Ez a fájl a Claude által generált tartalmat tartalmazza
// Kérlek másold be a teljes ProjectConductorAgent.ts tartalmat ide
// vagy használd a zip fájlt
"@
    "EdgeProxyAgent.ts" = @"
// Ez a fájl a Claude által generált tartalmat tartalmazza
// Kérlek másold be a teljes EdgeProxyAgent.ts tartalmat ide
// vagy használd a zip fájlt
"@
}

Write-Host @"

MEGJEGYZÉS: Az ügynök fájlokat manuálisan kell bemásolni a zip-ből:
  1. Csomagold ki a bas-conductor-update.zip fájlt
  2. Másold a src/agents/*.ts fájlokat ide: $srcAgents

"@ -ForegroundColor Yellow

# Conductor mappák létrehozása
Write-Step "Conductor track mappák létrehozása..."

$trackDirs = @(
    "conductor\tracks\cloudflare_edge_integration_20260202",
    "conductor\tracks\project_conductor_agent_20260202"
)

foreach ($dir in $trackDirs) {
    $fullPath = Join-Path $ProjectRoot $dir
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Létrehozás: $dir"
    } else {
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Success "Létrehozva: $dir"
        } else {
            Write-Host "  Már létezik: $dir"
        }
    }
}

# Cloudflare mappa létrehozása
Write-Step "Cloudflare mappa struktúra létrehozása..."

$cloudflareDirs = @(
    "cloudflare",
    "cloudflare\src",
    "src\edge",
    "src\edge\worker",
    "src\edge\tunnel",
    "src\edge\durable-objects"
)

foreach ($dir in $cloudflareDirs) {
    $fullPath = Join-Path $ProjectRoot $dir
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Létrehozás: $dir"
    } else {
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Success "Létrehozva: $dir"
        }
    }
}

# .env frissítés javaslata
Write-Step "Környezeti változók..."

$envAdditions = @"

# ========================================
# Cloudflare Edge Integration (NEW)
# ========================================
EDGE_ENABLED=false
CLOUDFLARE_ACCOUNT_ID=1bf6118df97f0e12f3592a89d90deb1e
CLOUDFLARE_API_TOKEN=your-api-token-here
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.workers.dev
CLOUDFLARE_TUNNEL_ENABLED=false
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
EDGE_FALLBACK_TO_LOCAL=true
EDGE_HEALTH_CHECK_INTERVAL=30000
"@

$envPath = Join-Path $ProjectRoot ".env"
Write-Host @"

Add hozzá a következőket a .env fájlhoz ($envPath):
$envAdditions

"@ -ForegroundColor Cyan

# package.json script javaslatok
Write-Step "package.json script javaslatok..."

Write-Host @"

Add hozzá ezeket a package.json "scripts" szekciójához:

  "conductor:status": "ts-node src/agents/ProjectConductorAgent.ts status",
  "conductor:sync": "ts-node src/agents/ProjectConductorAgent.ts sync",
  "conductor:health": "ts-node src/agents/ProjectConductorAgent.ts health",
  "edge:dev": "cd cloudflare && wrangler dev",
  "edge:deploy": "cd cloudflare && wrangler deploy",
  "tunnel:start": "cloudflared tunnel run brunella",
  "full:start": "concurrently \"npm run dev\" \"npm run tunnel:start\" \"npm run dev:ui\""

"@ -ForegroundColor Cyan

# Következő lépések
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                    KÖVETKEZŐ LÉPÉSEK                         ║
╚══════════════════════════════════════════════════════════════╝

1. FÁJLOK BEMÁSOLÁSA
   Csomagold ki a bas-conductor-update.zip fájlt és másold:
   - src/agents/ProjectConductorAgent.ts
   - src/agents/EdgeProxyAgent.ts
   - src/agents/AgentManager.ts (FELÜLÍR!)
   - src/agents/registry.json (FELÜLÍR!)
   - conductor/tracks.md (FELÜLÍR!)
   - conductor/workflow.md (FELÜLÍR!)
   - conductor/SUMMARY.md
   - conductor/tracks/cloudflare_edge_integration_20260202/plan.md
   - cloudflare/* (összes fájl)

2. KÖRNYEZETI VÁLTOZÓK
   Szerkeszd a .env fájlt és add hozzá a Cloudflare változókat

3. BUILD ÉS TESZT
   npm run build
   npm run test

4. ELSŐ FUTTATÁS
   npm run dev
   # Majd próbáld ki:
   brunella agent ProjectConductor "status"

5. CLOUDFLARE BEÁLLÍTÁS (opcionális)
   npm install -g wrangler
   wrangler login
   npm run edge:deploy

"@ -ForegroundColor Green

Write-Host "`nTelepítés befejezve!`n" -ForegroundColor Cyan
