# GIT SZINKRONIZÁCIÓS SCRIPT (Brunella Core)
# Ez a script automatizálja a változtatások feltöltését a main ágra.

$ErrorActionPreference = "Stop"

Write-Host "🔄 Brunella Git Szinkronizáció..." -ForegroundColor Cyan

# 1. Státusz ellenőrzése
$status = git status --porcelain
if (-not $status) {
    Write-Host "✅ Nincs új változtatás a munkakönyvtárban." -ForegroundColor Green
    exit
}

# 2. Változások hozzáadása
Write-Host "📦 Változások hozzáadása (git add .)..." -ForegroundColor Yellow
git add .

# 3. Commit üzenet bekérése
$commitMsg = Read-Host "📝 Kérlek add meg a commit üzenetet (pl. 'Ops Agent implementation')"
if (-not $commitMsg) {
    $commitMsg = "Update: Brunella Core improvements"
}

# 4. Commit
Write-Host "💾 Commit létrehozása..." -ForegroundColor Yellow
git commit -m "$commitMsg"

# 5. Push a main ágra
Write-Host "🚀 Feltöltés a 'main' ágra..." -ForegroundColor Yellow
# Feltételezzük, hogy a 'main' az alapértelmezett és létezik upstream
# Ha nincs beállítva upstream, ez dobhat hibát, de feltételezzük a repo helyes beállítását
try {
    git push origin main
    Write-Host "✅ Sikeres feltöltés!" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Hiba a feltöltés során. Ellenőrizd a remote beállításokat." -ForegroundColor Red
    Write-Host $_
}

# 6. Takarítás (Opcionális: itt lehetne merge/delete logikát rakni, ha lennének feature ágak)
Write-Host "🧹 Ágak karbantartása: Most a main ágon vagyunk." -ForegroundColor Gray
