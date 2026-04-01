@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title BRUNELLA MASTER CONTROL - START-FULL

:: ============================================================================
:: RENDSZER BEALLITASOK
:: ============================================================================
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

echo.
echo  +==================================================================+
echo  ^|       BRUNELLA AGENT SYSTEM - TELJES RENDSZER INDITAS           ^|
echo  +==================================================================+
echo.

:: ============================================================================
:: [0/8] ZOMBIE FOLYAMATOK TISZTITASA
:: ============================================================================
echo [0/8] Korabbi zombie/duplicate processzek ellenorzese...

:: Ha .brunella.pid letezik es a folyamat nem fut -> elavult lock torlese
if exist "%PROJECT_ROOT%\.brunella.pid" (
    set /p OLD_PID=<"%PROJECT_ROOT%\.brunella.pid"
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find /I "node.exe" >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        del /F /Q "%PROJECT_ROOT%\.brunella.pid" >nul 2>&1
        echo    [OK] Elavult .brunella.pid torolve (PID !OLD_PID! nem fut^)
    ) else (
        echo    [!!] Brunella mar fut (PID !OLD_PID!^) -- leallitas...
        taskkill /F /PID !OLD_PID! >nul 2>&1
        del /F /Q "%PROJECT_ROOT%\.brunella.pid" >nul 2>&1
        timeout /t 2 /nobreak >nul
        echo    [OK] Regi folyamat leallitva
    )
)

echo.

:: ============================================================================
:: [1/8] DOKUMENTACIO ES KONTEXTUS FRISSITESE
:: ============================================================================
echo [1/8] Dokumentumok egyesitese es szinkronizalasa...

:: FOSZAL szinkron
if exist "scripts\sync_foszal.py" (
    python scripts\sync_foszal.py >nul 2>&1
    echo    [OK] FOSZAL naplo frissitve
) else (
    echo    [!!] scripts\sync_foszal.py nem talalhato
)

:: Master Context frissites
if exist "scripts\update_master_context.ts" (
    call npx tsx scripts\update_master_context.ts >nul 2>&1
    echo    [OK] BRUNELLA_MASTER_CONTEXT.md generalva
)

:: Gemini App szinkron
if exist "scripts\sync_gemini_app.ps1" (
    powershell -ExecutionPolicy Bypass -File scripts\sync_gemini_app.ps1 >nul 2>&1
    echo    [OK] Kulso kontextus szinkronizalva
)

echo.

:: ============================================================================
:: [2/8] AI MOTOROK (Ollama)
:: ============================================================================
echo [2/8] AI Motorok ellenorzese...

curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Ollama mar fut (11434^)
) else (
    echo    [!!] Ollama nem fut, inditas...
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe" (
        start "" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
        timeout /t 6 /nobreak >nul
        echo    [OK] Ollama elindult
    ) else (
        echo    [XX] Ollama nem talalhato! Telepitsd: https://ollama.com
    )
)

echo.

:: ============================================================================
:: [3/8] BUILD (ha szukseges)
:: ============================================================================
echo [3/8] TypeScript build ellenorzese...

if not exist "build\index.js" (
    echo    [..] Build szukseges, forditas folyamatban...
    call npm run build 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Build sikeres
    ) else (
        echo    [XX] BUILD HIBA! Javitsd a hibakat mielott folytatnad.
        pause
        exit /b 1
    )
) else (
    echo    [OK] Build friss (build\index.js letezik^)
)

echo.

:: ============================================================================
:: [4/8] TESZTEK
:: ============================================================================
echo [4/8] Vitest tesztek futtatasa (ez eltarthat 1-2 percig^)...
echo    [..] npm test inditas...

call npm test 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Minden teszt PASS
) else (
    echo    [!!] Egyes tesztek FAIL - ellenorizd a kimenetelt
    echo    [!!] A rendszer folytatatodik, de javitsd a teszteket!
)

echo.

:: ============================================================================
:: [5/8] PYTHON HATTERRENDSZER (FastAPI)
:: ============================================================================
echo [5/8] Python FastAPI + Uvicorn ellenorzese...

curl -s --max-time 2 http://localhost:8000/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Python API mar fut (8000^)
) else (
    echo    [..] Python API elinditasa...

    :: uv ellenorzes (preferalt)
    where uv >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        start "BAS Python API" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
        echo    [OK] Python FastAPI elinditva (uv^)
    ) else (
        :: venv fallback
        set "VENV_PATH="
        if exist "%PROJECT_ROOT%\.venv\Scripts\activate.bat" set "VENV_PATH=%PROJECT_ROOT%\.venv\Scripts\activate.bat"
        if exist "%PROJECT_ROOT%\myai\.venv\Scripts\activate.bat" set "VENV_PATH=%PROJECT_ROOT%\myai\.venv\Scripts\activate.bat"
        if exist "%PROJECT_ROOT%\mcp_env\Scripts\activate.bat" set "VENV_PATH=%PROJECT_ROOT%\mcp_env\Scripts\activate.bat"

        if defined VENV_PATH (
            start "BAS Python API" /MIN cmd /k "call !VENV_PATH! && cd /d %PROJECT_ROOT%\myai && uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
            echo    [OK] Python FastAPI elinditva (venv^)
        ) else (
            echo    [XX] Python venv nem talalhato! Futtasd: cd myai ^&^& uv sync
        )
    )
)

echo.

:: ============================================================================
:: [6/8] NODE.JS BACKEND (Express + Socket.IO)
:: ============================================================================
echo [6/8] Node.js Backend ellenorzese...

curl -s --max-time 2 http://localhost:3000/api/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Backend mar fut (3000^)
) else (
    :: Zombie process leallitasa ha port foglalt de curl nem valaszol
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
        echo    [..] Zombie process leallitasa: PID %%a
        taskkill /F /PID %%a >nul 2>&1
    )

    echo    [..] Backend elinditasa...
    start "BAS Backend (MCP + Express)" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev"
    echo    [OK] Backend indul (http://localhost:3000^)
)

echo.

:: ============================================================================
:: [7/8] DASHBOARD UI (Vite)
:: ============================================================================
echo [7/8] Dashboard UI ellenorzese...

curl -s --max-time 2 http://localhost:5173 >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Dashboard mar fut (5173^)
) else (
    start "BAS Dashboard UI" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev:ui"
    echo    [OK] Dashboard indul (http://localhost:5173^)
)

echo.

:: ============================================================================
:: [8/8] OPCIONALIS SZOLGALTATASOK
:: ============================================================================
echo [8/8] Opcionalis szolgaltatasok...

:: AnythingLLM
tasklist /FI "IMAGENAME eq AnythingLLM.exe" 2>NUL | find /I "AnythingLLM.exe" >NUL
if !ERRORLEVEL! EQU 0 (
    echo    [OK] AnythingLLM mar fut
) else (
    if exist "C:\Program Files\AnythingLLM\AnythingLLM.exe" (
        start "" "C:\Program Files\AnythingLLM\AnythingLLM.exe"
        echo    [OK] AnythingLLM elindult
    ) else (
        echo    [--] AnythingLLM nem talalhato (nem kotelezo^)
    )
)

:: Cloudflare D1 szinkron
if exist "wrangler.jsonc" (
    echo    [..] Cloudflare D1 migraciok alkalmazasa...
    call npx wrangler d1 migrations apply bas-metadata --remote --yes >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] D1 SQL szinkronizalva
    ) else (
        echo    [!!] D1 szinkron hiba (lehet nincs uj migracio - normalis^)
    )
) else (
    echo    [--] wrangler.jsonc nem talalhato (D1 szinkron kihagyva^)
)

echo.

:: ============================================================================
:: HEALTH CHECK (15mp varako a szolgaltatasok inditasara)
:: ============================================================================
echo Rendszer elindul, health check 15 masodperc mulva...
timeout /t 15 /nobreak >nul

call npm run health

echo.
echo +------------------------------------------------------------------+
echo ^|  RENDSZER KESZ                                                   ^|
echo +------------------------------------------------------------------+
echo.
echo   Dashboard : http://localhost:5173
echo   API       : http://localhost:3000
echo   Python    : http://localhost:8000
echo   Ollama    : http://localhost:11434
echo.
echo   Hasznos parancsok:
echo     brunella chat          - Interaktiv chat
echo     brunella agents        - Ugynoklistak
echo     brunella conductor status - Projekt statusz
echo.

pause
