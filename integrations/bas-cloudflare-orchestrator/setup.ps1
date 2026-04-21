# BAS Cloudflare Orchestrator - Setup Script
# Futtasd PowerShell-ben rendszergazdaként

$ProjectRoot = "C:\Projects\bas-cloudflare-orchestrator"

Write-Host "🚀 BAS Cloudflare Orchestrator Setup" -ForegroundColor Cyan
Write-Host "=" * 50

# 1. Projekt mappa létrehozása
Write-Host "`n📁 Projekt mappa létrehozása..." -ForegroundColor Yellow
if (-not (Test-Path $ProjectRoot)) {
    New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null
    New-Item -ItemType Directory -Path "$ProjectRoot\src" -Force | Out-Null
    New-Item -ItemType Directory -Path "$ProjectRoot\local" -Force | Out-Null
    Write-Host "   ✅ Mappák létrehozva: $ProjectRoot" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Mappa már létezik: $ProjectRoot" -ForegroundColor Yellow
}

# 2. Fájlok másolása (ha Claude generálta őket)
Write-Host "`n📄 Fájlok ellenőrzése..." -ForegroundColor Yellow
$requiredFiles = @(
    "package.json",
    "wrangler.jsonc", 
    "tsconfig.json",
    "src\index.ts",
    "local\browser_use_api.py",
    "local\requirements.txt",
    "README.md"
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $ProjectRoot $file
    if (Test-Path $fullPath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file - HIÁNYZIK!" -ForegroundColor Red
    }
}

# 3. NPM függőségek telepítése
Write-Host "`n📦 NPM függőségek telepítése..." -ForegroundColor Yellow
Set-Location $ProjectRoot
if (Test-Path "package.json") {
    npm install
    Write-Host "   ✅ NPM csomagok telepítve" -ForegroundColor Green
}

# 4. KV Namespace létrehozása
Write-Host "`n🗄️ Cloudflare KV Namespace..." -ForegroundColor Yellow
Write-Host "   Futtasd manuálisan: npm run kv:create" -ForegroundColor Cyan
Write-Host "   Majd másold be az ID-t a wrangler.jsonc-be!" -ForegroundColor Cyan

# 5. Python környezet (opcionális)
Write-Host "`n🐍 Python Browser-Use API setup..." -ForegroundColor Yellow
$localDir = "$ProjectRoot\local"
if (Test-Path "$localDir\requirements.txt") {
    Set-Location $localDir
    if (-not (Test-Path "venv")) {
        python -m venv venv
        Write-Host "   ✅ Python venv létrehozva" -ForegroundColor Green
    }
    Write-Host "   Aktiváláshoz: .\venv\Scripts\Activate.ps1" -ForegroundColor Cyan
    Write-Host "   Telepítéshez: pip install -r requirements.txt" -ForegroundColor Cyan
}

# 6. Következő lépések
Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "📋 KÖVETKEZŐ LÉPÉSEK:" -ForegroundColor Green
Write-Host ""
Write-Host "1. KV Namespace létrehozása:" -ForegroundColor White
Write-Host "   cd $ProjectRoot" -ForegroundColor Gray
Write-Host "   npm run kv:create" -ForegroundColor Gray
Write-Host "   # Másold be az ID-t a wrangler.jsonc-be!" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Worker deploy:" -ForegroundColor White
Write-Host "   npm run deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Lokális API indítása:" -ForegroundColor White
Write-Host "   cd $ProjectRoot\local" -ForegroundColor Gray
Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "   pip install -r requirements.txt" -ForegroundColor Gray
Write-Host "   python browser_use_api.py" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Tesztelés:" -ForegroundColor White
Write-Host '   curl -X POST https://bas-orchestrator.workers.dev/task -H "Content-Type: application/json" -d "{\"instruction\": \"Teszt feladat\"}"' -ForegroundColor Gray

Set-Location $ProjectRoot
Write-Host "`n✨ Setup kész!" -ForegroundColor Green
