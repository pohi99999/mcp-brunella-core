#Requires -Version 5.1
<#
.SYNOPSIS
  Beüzemeli a Cloudflare Quick Tunnelt a Brunella Dashboard távoli eléréséhez.
.DESCRIPTION
  Letölti a cloudflared-et (ha hiányzik), majd indít egy tunnelt a localhost:5173 felé.
  A generált trycloudflare.com URL megjelenik a konzolon.
.EXAMPLE
  .\scripts\start_remote.ps1
#>

$ErrorActionPreference = "Stop"

# Projekt gyökér (ahol a script mappája van -> egy szinttel feljebb)
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$BinDir     = Join-Path $ProjectRoot "bin"
$CloudflaredExe = Join-Path $BinDir "cloudflared.exe"
$DownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * ([Math]::Min($Text.Length, 60))) -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Text)
    Write-Host "  [OK] $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "  [!] $Text" -ForegroundColor Yellow
}

# --- 1. Ellenőrzés: bin mappa és cloudflared.exe ---
Write-Header "Brunella – Remote Access (Cloudflare Tunnel)"

if (-not (Test-Path $BinDir)) {
    Write-Step "A 'bin' mappa nem létezik, létrehozás..."
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    Write-Success "bin mappa létrehozva: $BinDir"
} else {
    Write-Success "bin mappa megvan: $BinDir"
}

if (-not (Test-Path $CloudflaredExe)) {
    Write-Step "cloudflared.exe hiányzik, letöltés..."
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $CloudflaredExe -UseBasicParsing
        Write-Success "Letöltve: $CloudflaredExe"
    } catch {
        Write-Host "  [HIBA] Letöltés sikertelen: $_" -ForegroundColor Red
        Write-Host "  URL: $DownloadUrl" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Success "cloudflared.exe megvan: $CloudflaredExe"
}

# --- 2. Emlékeztető: Dashboard fusson ---
Write-Host ""
Write-Host "  A Dashboardnak futnia kell a localhost:5173-en (npm run dev:ui)." -ForegroundColor Yellow
Write-Host "  Ha még nem indult, nyiss másik terminált és futtasd: npm run dev:ui" -ForegroundColor Yellow
Write-Host ""

# --- 3. Tunnel indítása ---
Write-Header "Tunnel indítása: http://localhost:5173"
Write-Host "  Parancs: cloudflared tunnel --url http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "  MASOLD KI AZ URL-T A TERMINALBOL ES NYISD MEG A TELEFONODON!" -ForegroundColor Green
Write-Host "  (A *.trycloudflare.com link megjelenik alább.)" -ForegroundColor Green
Write-Host ""

try {
    & $CloudflaredExe tunnel --url http://localhost:5173
} catch {
    Write-Host ""
    Write-Host "  [HIBA] Tunnel indítás sikertelen: $_" -ForegroundColor Red
    exit 1
}
