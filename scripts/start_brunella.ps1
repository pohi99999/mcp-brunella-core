# Brunella Indító Script
# Elindítja az Ollama-t és a Brunella Screvert

Write-Host "🚀 Brunella Rendszer Indítása..." -ForegroundColor Green

# 1. Ollama ellenőrzése és indítása
$ollamaProcess = Get-Process ollama -ErrorAction SilentlyContinue
if (-not $ollamaProcess) {
    Write-Host "🤖 Ollama indítása..." -ForegroundColor Yellow
    # Háttérben indítjuk
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    
    # Várunk kicsit, hogy elinduljon
    Write-Host "⏳ Várakozás az Ollama-ra..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    
    # Ellenőrzés
    if (Get-Process ollama -ErrorAction SilentlyContinue) {
        Write-Host "✅ Ollama sikeresen elindult." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Nem sikerült elindítani az Ollama-t. Kérlek indítsd el kézzel!" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Ollama már fut." -ForegroundColor Cyan
}

# 2. Build ellenőrzése
if (-not (Test-Path "build/index.js")) {
    Write-Host "🛠️ Build nem található. Fordítás..." -ForegroundColor Yellow
    npm run build
}

# 3. Brunella Core Indítása
Write-Host "🌐 Brunella Core + Dashboard indítása..." -ForegroundColor Green
Write-Host "Nyomj Ctrl+C-t a leállításhoz." -ForegroundColor Gray
npm start
