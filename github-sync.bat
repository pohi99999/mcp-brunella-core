@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

echo.
echo +=============================================+
echo ^|   Brunella GitHub Auto-Sync               ^|
echo +=============================================+
echo.

:: Gyoker mappa beallitasa
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

:: -----------------------------------------------
:: 1. Ellenorzes: git repo?
:: -----------------------------------------------
echo [1/6] Git repository ellenorzese...
git rev-parse --is-inside-work-tree >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [XX] HIBA: Nem git repository! Futtasd a projekt gyokerebol.
    pause & exit /b 1
)
echo [OK] Repository: %PROJECT_ROOT%

:: -----------------------------------------------
:: 2. Remote ellenorzese
:: -----------------------------------------------
echo.
echo [2/6] Remote ellenorzese...
for /f "tokens=*" %%r in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%r"
if "!REMOTE_URL!"=="" (
    echo [XX] HIBA: Nincs remote (origin) beallitva!
    pause & exit /b 1
)
echo [OK] Remote: !REMOTE_URL!

:: -----------------------------------------------
:: 3. Pull (elobb szinkronizal a remote-bol)
:: -----------------------------------------------
echo.
echo [3/6] Pull - GitHub valtozasok letoltese...
git fetch origin 2>&1
git pull origin main 2>&1
if !ERRORLEVEL! neq 0 (
    echo [!!] FIGYELEM: Pull konfliktus lehet. Ellenorizd: git status
    echo      Folytassuk a push-sal? (Ctrl+C = Megszakitas, Enter = Folytatas)
    pause
)
echo [OK] Pull kesz.

:: -----------------------------------------------
:: 4. FOSZAL dokumentum frissites (ha van Python)
:: -----------------------------------------------
echo.
echo [4/6] FOSZAL dokumentum szinkronizalasa...
python scripts\sync_foszal.py 2>nul
if !ERRORLEVEL! equ 0 (
    echo [OK] FOSZAL frissult.
) else (
    echo [--] FOSZAL frissites atugorra (Python nem elerheto).
)

:: -----------------------------------------------
:: 5. Stage + Commit (csak ha van valtozas)
:: -----------------------------------------------
echo.
echo [5/6] Valtozasok ellenorzese es commit...

:: Ellenorizzuk van-e valtozas
git status --short >nul 2>&1
for /f "tokens=*" %%s in ('git status --short 2^>nul') do (
    set "HAS_CHANGES=1"
    goto :has_changes
)
goto :no_changes

:has_changes
echo [--] Valtozott fajlok:
git status --short
echo.

:: Timestamp alapu commit uzenet
for /f "tokens=1-2 delims= " %%a in ('wmic os get LocalDateTime /value 2^>nul ^| findstr "LocalDateTime"') do set "DT=%%b"
if "!DT!"=="" (
    for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "DT=%%d"
)
set "COMMIT_MSG=chore: auto-sync !DT:~0,8!_!DT:~8,6!"

:: Stage all tracked changes (nem untracked)
git add -u

:: Uj fajlok is? Megkerdezi
for /f "tokens=*" %%u in ('git ls-files --others --exclude-standard 2^>nul') do (
    set "HAS_UNTRACKED=1"
    goto :check_untracked
)
goto :do_commit

:check_untracked
echo [!!] Uj (untracked) fajlok is vannak:
git ls-files --others --exclude-standard | head -10 2>/dev/null || git ls-files --others --exclude-standard
echo.
set /p "ADD_NEW=Hozzaadjuk az uj fajlokat is? (i/n): "
if /i "!ADD_NEW!"=="i" (
    git add .
    echo [OK] Minden uj fajl hozzaadva.
)

:do_commit
git commit -m "!COMMIT_MSG!" 2>&1
if !ERRORLEVEL! equ 0 (
    echo [OK] Commit: !COMMIT_MSG!
) else (
    echo [--] Nincs commitolando valtozas (mar staged? vagy ures commit).
)
goto :push

:no_changes
echo [OK] Nincs valtozas - push-ra csak az elmaradozott commit-ok kerulnek fel.

:push
:: -----------------------------------------------
:: 6. Push
:: -----------------------------------------------
echo.
echo [6/6] Push - feltoltes GitHub-ra...
git push origin main 2>&1
if !ERRORLEVEL! equ 0 (
    echo.
    echo +=============================================+
    echo ^|   [OK] SZINKRON KESZ!                    ^|
    echo +=============================================+
    echo.
    echo Utolso 5 commit:
    git log --oneline -5
    echo.
    echo GitHub: !REMOTE_URL!
) else (
    echo.
    echo [XX] HIBA: Push sikertelen!
    echo      Ellenorizd: git status, git log --oneline -5
    echo      Ha token hiba: git remote set-url origin https://TOKEN@github.com/...
    pause
    exit /b 1
)

echo.
echo Kesz. Nyomj Enter-t a bezarashoz...
pause >nul
endlocal
