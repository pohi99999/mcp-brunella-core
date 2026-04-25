@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "DASHBOARD_URL=http://localhost:5173"

TITLE 🚀 BRUNELLA PHASE 5 UNIFIED LAUNCHER 🚀

echo ======================================================
echo          BRUNELLA AGENT SYSTEM - DASHBOARD
echo ======================================================
echo.

echo [1/7] SZINKRONIZÁLÁS: Dokumentáció és struktúra...
call npm run sync:docs
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Dokumentáció szinkronizálása hibás, de folytatjuk...
)

echo [2/7] ELLENŐRZÉS: Ollama Szerver...
tasklist /fi "ImageName eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo    - Ollama indítása...
    start /b "" ollama serve
) else (
    echo    - Ollama már fut.
)

echo [3/7] ELLENŐRZÉS: AnythingLLM...
where AnythingLLM.exe >nul 2>&1
if %ERRORLEVEL%==0 (
    start /b "" AnythingLLM.exe
    echo    - AnythingLLM elindítva a háttérben.
) else (
    echo    - AnythingLLM nem található, kihagyva.
)

echo [4/7] ELLENŐRZÉS: Python FastAPI Backend (Port 8000)...
call :IsPortListening 8000
if not errorlevel 1 (
    echo    - Python már fut a 8000-es porton, nem indítunk második példányt.
) else (
    echo    - Python indítása...
    start /b "Brunella-Python" npm run start:python:stable
)

echo [5/7] ELLENŐRZÉS: Node Core Server (Port 3000)...
call :IsPortListening 3000
if not errorlevel 1 (
    echo    - Core API már fut a 3000-es porton, nem indítunk második példányt.
) else (
    echo    - Core API indítása...
    start /b "Brunella-Core" npm run dev
)

echo [6/7] ELLENŐRZÉS: Dashboard UI (Port 5173)...
call :IsPortListening 5173
if not errorlevel 1 (
    echo    - Dashboard már fut az 5173-as porton, nem indítunk második példányt.
) else (
    echo    - Dashboard indítása fix 5173-as porton...
    start /b "Brunella-Dashboard" npm run dev:ui -- --host 0.0.0.0 --port 5173 --strictPort
)

echo.
echo [7/7] INICIALIZÁLÁS: Várakozás a szerverekre (15 mp)...
echo    - Kérlek várj, amíg a 95 ügynök és a memória betöltődik...
timeout /t 15 /nobreak > nul

echo.
echo [OK] Megnyitás: Alapértelmezett böngésző...
start %DASHBOARD_URL%

echo.
echo ======================================================
echo ✅ BRUNELLA RENDESZER ÜZEMKÉSZ!
echo.
echo 🖥️  Dashboard: %DASHBOARD_URL%
echo 🧠  Core API:  http://localhost:3000
echo 🐍  Python:    http://localhost:8000
echo 🤖  Ollama:    http://localhost:11434
echo ======================================================
echo.
echo FIGYELEM: Ne zárd be ezt az ablakot, amíg a rendszert használod!
echo A folyamatok a háttérben futnak ebben a munkamenetben.
echo.
pause
exit /b 0

:IsPortListening
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } exit 1" >nul 2>&1
exit /b %ERRORLEVEL%
