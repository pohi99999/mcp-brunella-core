@echo off
setlocal
cd /d "F:\mcp-brunella-core"

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

echo [4/7] INDÍTÁS: Python FastAPI Backend (Port 8000)...
start /b "Brunella-Python" npm run start:python:stable

echo [5/7] INDÍTÁS: Node Core Server (Port 3000)...
start /b "Brunella-Core" npm run dev

echo [6/7] INDÍTÁS: Dashboard UI (Port 5173)...
start /b "Brunella-Dashboard" npm run dev:ui

echo.
echo [7/7] INICIALIZÁLÁS: Várakozás a szerverekre (15 mp)...
echo    - Kérlek várj, amíg a 78 ügynök és a memória betöltődik...
timeout /t 15 /nobreak > nul

echo.
echo [OK] Megnyitás: Alapértelmezett böngésző...
start http://localhost:5173

echo.
echo ======================================================
echo ✅ BRUNELLA RENDESZER ÜZEMKÉSZ!
echo.
echo 🖥️  Dashboard: http://localhost:5173
echo 🧠  Core API:  http://localhost:3000
echo 🐍  Python:    http://localhost:8000
echo 🤖  Ollama:    http://localhost:11434
echo ======================================================
echo.
echo FIGYELEM: Ne zárd be ezt az ablakot, amíg a rendszert használod!
echo A folyamatok a háttérben futnak ebben a munkamenetben.
echo.
pause
