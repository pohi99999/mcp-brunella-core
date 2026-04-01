@echo off
:: ============================================================
:: kill-brunella-ghosts.bat
:: Beragadt / zombie Brunella Node + Python folyamatok leallitasa
:: Futtasd mielott uj start-full.bat-ot inditasz!
:: ============================================================
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Brunella Ghost Killer

echo.
echo =============================================
echo  Brunella Ghost Killer
echo =============================================

:: ---- 1. Port-foglalas ellenorzese ----
echo.
echo [1/4] Port-foglaltsag ellenorzese (3000, 8000, 5173)...

for %%P in (3000 8000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano 2^>nul ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo    [!!] Port %%P foglalt -- PID %%A leallitasa...
        taskkill /F /PID %%A >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo    [OK] PID %%A leallitva
        ) else (
            echo    [XX] PID %%A leallitasa sikertelen (lehet mar nem fut)
        )
    )
)

:: ---- 2. Brunella PID fajl torlese ----
echo.
echo [2/4] .brunella.pid fajl torlese (ha letezik)...

if exist "%~dp0..\.brunella.pid" (
    del /F /Q "%~dp0..\.brunella.pid" >nul 2>&1
    echo    [OK] .brunella.pid torolve
) else (
    echo    [OK] .brunella.pid nem letezik
)

:: ---- 3. build\index.js-t futtato node processzek leallitasa ----
echo.
echo [3/4] build\index.js node processzek leallitasa...

for /f "tokens=2" %%A in ('wmic process where "name='node.exe' and commandline like '%%build\\index%%'" get processid 2^>nul ^| findstr /r "[0-9]"') do (
    echo    [!!] build\index.js node folyamat: PID %%A leallitasa...
    taskkill /F /PID %%A >nul 2>&1
)

:: ---- 4. uvicorn processzek (FastAPI) ellenorzese ----
echo.
echo [4/4] Uvicorn (FastAPI :8000) ellenorzese...

for /f "tokens=2" %%A in ('wmic process where "name='python.exe' and commandline like '%%uvicorn%%'" get processid 2^>nul ^| findstr /r "[0-9]"') do (
    echo    [!!] Uvicorn folyamat: PID %%A leallitasa...
    taskkill /F /PID %%A >nul 2>&1
)

echo.
echo =============================================
echo  Kesz! Biztonsan elindithato: start-full.bat
echo =============================================
echo.
pause
