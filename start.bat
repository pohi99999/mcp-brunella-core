@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title BRUNELLA AGENT SYSTEM - START

:: ============================================================================
:: PROJEKT KONYVTAR
:: ============================================================================
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

if not exist "src\cli.ts" (
    echo [HIBA] Ez a start.bat nem a Brunella repo mappabol fut.
    pause
    exit /b 1
)

echo.
echo  +==================================================================+
echo  ^|        BRUNELLA AGENT SYSTEM - RENDSZER INDITAS                 ^|
echo  +==================================================================+
echo.

:: ============================================================================
:: [1/6] OLLAMA (AI Motor)
:: ============================================================================
echo [1/6] Ollama ellenorzese (http://localhost:11434)...
curl -s --max-time 3 http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Ollama mar fut.
) else (
    echo    [..] Ollama inditasa...
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe" (
        start "" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
        timeout /t 6 /nobreak >nul
        curl -s --max-time 3 http://localhost:11434/api/tags >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo    [OK] Ollama elindult.
        ) else (
            echo    [!!] Ollama lassan indul, de folytatjuk...
        )
    ) else (
        echo    [XX] Ollama nem talalhato! Telepitsd: https://ollama.com
    )
)
echo.

:: ============================================================================
:: [2/6] ANYTHINGLLM
:: ============================================================================
echo [2/6] AnythingLLM ellenorzese...
tasklist /FI "IMAGENAME eq AnythingLLM.exe" 2>NUL | find /I "AnythingLLM.exe" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] AnythingLLM mar fut.
) else (
    if exist "C:\Program Files\AnythingLLM\AnythingLLM.exe" (
        echo    [..] AnythingLLM inditasa...
        start "" "C:\Program Files\AnythingLLM\AnythingLLM.exe"
        echo    [OK] AnythingLLM elinditva.
    ) else if exist "C:\Users\%USERNAME%\AppData\Local\Programs\AnythingLLM\AnythingLLM.exe" (
        echo    [..] AnythingLLM inditasa...
        start "" "C:\Users\%USERNAME%\AppData\Local\Programs\AnythingLLM\AnythingLLM.exe"
        echo    [OK] AnythingLLM elinditva.
    ) else (
        echo    [--] AnythingLLM nem talalhato, kihagyva.
    )
)
echo.

:: ============================================================================
:: [3/6] TYPESCRIPT BUILD (ha szukseges)
:: ============================================================================
echo [3/6] Build ellenorzese...
if not exist "build\index.js" (
    echo    [..] Build szukseges, forditas...
    call npm run build >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Build sikeres.
    ) else (
        echo    [XX] BUILD HIBA! Javitsd eloszor.
        pause
        exit /b 1
    )
) else (
    echo    [OK] Build konyvtar megvan.
)
echo.

:: ============================================================================
:: [4/6] PYTHON FASTAPI BACKEND (:8000)
:: ============================================================================
echo [4/6] Python API ellenorzese (http://localhost:8000)...
curl -s --max-time 3 http://localhost:8000/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Python API mar fut.
) else (
    echo    [..] Python API inditasa...
    if exist ".venv\Scripts\python.exe" (
        start "BAS Python API" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && %PROJECT_ROOT%\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
    ) else (
        start "BAS Python API" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
    )
    timeout /t 4 /nobreak >nul
    curl -s --max-time 3 http://localhost:8000/health >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Python API elindult.
    ) else (
        echo    [!!] Python API lassan indul, de folytatjuk...
    )
)
echo.

:: ============================================================================
:: [5/6] NODE.JS EXPRESS BACKEND (:3000)
:: ============================================================================
echo [5/6] Node.js Backend ellenorzese (http://localhost:3000)...
curl -s --max-time 3 http://localhost:3000/api/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Backend mar fut.
) else (
    echo    [..] Node.js Backend inditasa...
    start "BAS Backend :3000" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev"
    timeout /t 8 /nobreak >nul
    curl -s --max-time 3 http://localhost:3000/api/health >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Backend elindult.
    ) else (
        echo    [!!] Backend lassan indul, de folytatjuk...
    )
)
echo.

:: ============================================================================
:: [6/6] VITE DASHBOARD (:5173)
:: ============================================================================
echo [6/6] Dashboard UI ellenorzese (http://localhost:5173)...
curl -s --max-time 3 http://localhost:5173 >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Dashboard mar fut.
) else (
    echo    [..] Dashboard inditasa...
    start "BAS Dashboard :5173" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev:ui"
    timeout /t 5 /nobreak >nul
    echo    [OK] Dashboard elinditva.
)
echo.

:: ============================================================================
:: OSSZEGZES
:: ============================================================================
echo  +==================================================================+
echo  ^|  Minden szolgaltatas elinditva!                                 ^|
echo  +==================================================================+
echo.
echo   Dashboard  : http://localhost:5173
echo   Backend    : http://localhost:3000
echo   Python API : http://localhost:8000
echo   Ollama     : http://localhost:11434
echo.

:: Dashboard megnyitasa bongeszoben
start http://localhost:5173

echo   A szolgaltatasoknak kb. 15-30 mp kell a teljes indulasig.
echo   Nyomd meg barmelyik billentyut a bezarashoz (a szerverek tovabb futnak).
echo.
pause