@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title BRUNELLA AGENT SYSTEM — PAIOS Orchestrator Startup

:: ============================================================================
:: PROJEKT KONYVTAR
:: ============================================================================
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

if not exist "src\cli.ts" (
    echo [HIBA] Ez a start.bat nem a Brunella repo mappajaban fut.
    pause
    exit /b 1
)

echo.
echo  +======================================================================+
echo  ^|     BRUNELLA AGENT SYSTEM  —  PAIOS ORCHESTRATOR INDITAS           ^|
echo  ^|     Copilot CLI: a rendszer agya, szive es orkesztrátora            ^|
echo  +======================================================================+
echo.

:: ============================================================================
:: [1/7] OLLAMA (AI Motor — lokalis LLM: gemma4:e4b, qwen2.5-coder:7b)
:: ============================================================================
echo [1/7] Ollama ellenorzese (http://localhost:11434)...
curl -s --max-time 3 http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Ollama mar fut.
) else (
    echo    [..] Ollama inditasa...
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe" (
        start "" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
        timeout /t 7 /nobreak >nul
        curl -s --max-time 3 http://localhost:11434/api/tags >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo    [OK] Ollama elindult — gemma4:e4b + qwen2.5-coder:7b elerheto.
        ) else (
            echo    [!!] Ollama lassan indul — folytatjuk...
        )
    ) else (
        echo    [XX] Ollama nem talalhato! Telepitsd: https://ollama.com
    )
)
echo.

:: ============================================================================
:: [2/7] ANYTHINGLLM (LLM Provider — GitHub Models gpt-4.1 / Ollama fallback)
:: ============================================================================
echo [2/7] AnythingLLM ellenorzese (http://localhost:3001)...
curl -s --max-time 3 http://localhost:3001 >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] AnythingLLM mar fut.
) else (
    set "ALLM_EXE="
    if defined ANYTHINGLLM_EXE_PATH (
        if exist "!ANYTHINGLLM_EXE_PATH!" set "ALLM_EXE=!ANYTHINGLLM_EXE_PATH!"
    )
    if not defined ALLM_EXE (
        if exist "C:\Users\%USERNAME%\AppData\Local\Programs\AnythingLLM\AnythingLLM.exe" (
            set "ALLM_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\AnythingLLM\AnythingLLM.exe"
        ) else if exist "C:\Program Files\AnythingLLM\AnythingLLM.exe" (
            set "ALLM_EXE=C:\Program Files\AnythingLLM\AnythingLLM.exe"
        )
    )
    if defined ALLM_EXE (
        echo    [..] AnythingLLM inditasa...
        start "" "!ALLM_EXE!"
        timeout /t 4 /nobreak >nul
        echo    [OK] AnythingLLM elinditva (port 3001).
    ) else (
        echo    [--] AnythingLLM nem talalhato, kihagyva.
    )
)
echo.

:: ============================================================================
:: [3/7] TYPESCRIPT BUILD (csak ha szükséges)
:: ============================================================================
echo [3/7] Build ellenorzese...
set "NEEDS_BUILD=0"
if not exist "build\index.js" set "NEEDS_BUILD=1"
if !NEEDS_BUILD! EQU 1 (
    echo    [..] Build szukseges, forditas folyamatban...
    call npm run build >"%PROJECT_ROOT%\build_start_log.txt" 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Build sikeres.
    ) else (
        echo    [XX] BUILD HIBA! Ellenorizd: build_start_log.txt
        pause
        exit /b 1
    )
) else (
    echo    [OK] Build naprakesz (build\index.js letezik).
)
echo.

:: ============================================================================
:: [4/7] PYTHON FASTAPI / UVICORN BACKEND (:8000)
:: ============================================================================
echo [4/7] Python FastAPI / Uvicorn ellenorzese (http://localhost:8000)...
curl -s --max-time 3 http://localhost:8000/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] FastAPI mar fut.
) else (
    echo    [..] FastAPI / Uvicorn inditasa...
    if exist "%PROJECT_ROOT%\.venv\Scripts\python.exe" (
        start "BAS FastAPI :8000" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && %PROJECT_ROOT%\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
    ) else (
        where uv >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            start "BAS FastAPI :8000" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
        ) else (
            start "BAS FastAPI :8000" /MIN cmd /k "cd /d %PROJECT_ROOT%\myai && python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
        )
    )
    timeout /t 5 /nobreak >nul
    curl -s --max-time 3 http://localhost:8000/health >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] FastAPI + Uvicorn elindult.
    ) else (
        echo    [!!] FastAPI lassan indul — folytatjuk...
    )
)
echo.

:: ============================================================================
:: [5/7] NODE.JS EXPRESS BACKEND — BAS MCP Szerver (:3000)
:: ============================================================================
echo [5/7] BAS Node.js Backend ellenorzese (http://localhost:3000)...
curl -s --max-time 3 http://localhost:3000/api/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Backend mar fut.
) else (
    echo    [..] BAS Backend inditasa (MCP + ZeroPrompt + Ephemeral + Federation)...
    start "BAS Backend :3000" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev"
    timeout /t 10 /nobreak >nul
    curl -s --max-time 3 http://localhost:3000/api/health >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Backend elindult — 53 MCP tool + teljes API betoltve.
    ) else (
        echo    [!!] Backend lassan indul — folytatjuk...
    )
)
echo.

:: ============================================================================
:: [6/7] VITE DASHBOARD (:5173)
:: ============================================================================
echo [6/7] Dashboard UI ellenorzese (http://localhost:5173)...
curl -s --max-time 3 http://localhost:5173 >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Dashboard mar fut.
) else (
    echo    [..] Dashboard inditasa...
    start "BAS Dashboard :5173" /MIN cmd /k "cd /d %PROJECT_ROOT% && npm run dev:ui"
    timeout /t 5 /nobreak >nul
    echo    [OK] Dashboard elinditva (http://localhost:5173).
)
echo.

:: ============================================================================
:: [7/7] COPILOT CLI — BRUNELLA PAIOS ORCHESTRATOR
::
::  Ez a Copilot CLI peldany a rendszer agya es szive.
::  Automatikusan betolti az MCP szervereket a mcp_servers.json-bol:
::    - brunella-core  : node build/index.js  (53 MCP tool)
::    - filesystem     : @modelcontextprotocol/server-filesystem
::    - windows_bridge : python windows_bridge/wab_server.py
::  LLM: GitHub Models gpt-4.1, fallback: Ollama qwen2.5-coder:7b / gemma4:e4b
:: ============================================================================
echo [7/7] Copilot CLI inditasa mint PAIOS Orchestrator...
timeout /t 3 /nobreak >nul

set "COPILOT_EXE=copilot"
if exist "C:\Users\%USERNAME%\AppData\Local\Microsoft\WinGet\Packages\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\copilot.exe" (
    set "COPILOT_EXE=C:\Users\%USERNAME%\AppData\Local\Microsoft\WinGet\Packages\GitHub.Copilot_Microsoft.Winget.Source_8wekyb3d8bbwe\copilot.exe"
) else if exist "C:\Users\%USERNAME%\AppData\Local\Microsoft\WinGet\Packages\GitHub.Copilot.Prerelease_Microsoft.Winget.Source_8wekyb3d8bbwe\copilot.exe" (
    set "COPILOT_EXE=C:\Users\%USERNAME%\AppData\Local\Microsoft\WinGet\Packages\GitHub.Copilot.Prerelease_Microsoft.Winget.Source_8wekyb3d8bbwe\copilot.exe"
)

start "BRUNELLA PAIOS ORCHESTRATOR — Copilot CLI" cmd /k ^
"cd /d %PROJECT_ROOT% && ^
echo. && ^
echo  +===========================================================+ && ^
echo  ^|  BRUNELLA PAIOS ORCHESTRATOR — KESZEN ALL               ^| && ^
echo  ^|                                                           ^| && ^
echo  ^|  MCP Szerverek:                                           ^| && ^
echo  ^|    brunella-core   :3000  (53 MCP tool)                  ^| && ^
echo  ^|    filesystem      workspace hozzaferes                  ^| && ^
echo  ^|    windows_bridge  PowerShell automation                 ^| && ^
echo  ^|                                                           ^| && ^
echo  ^|  LLM: GitHub Models gpt-4.1                              ^| && ^
echo  ^|       Ollama fallback: gemma4:e4b / qwen2.5-coder:7b    ^| && ^
echo  ^|                                                           ^| && ^
echo  ^|  Szerviz vegpontok:                                       ^| && ^
echo  ^|    Dashboard  http://localhost:5173                       ^| && ^
echo  ^|    Backend    http://localhost:3000                       ^| && ^
echo  ^|    Python API http://localhost:8000                       ^| && ^
echo  ^|    Ollama     http://localhost:11434                      ^| && ^
echo  ^|                                                           ^| && ^
echo  ^|  Te vagy a rendszer agya. Minden delegalas es            ^| && ^
echo  ^|  orkesztracio rajtad mulik. Magyar nyelven kommunikalnk. ^| && ^
echo  +===========================================================+ && ^
echo. && ^
"!COPILOT_EXE!""

echo    [OK] Copilot CLI PAIOS Orchestrator elindult — dedikalt ablakban.
echo.

:: ============================================================================
:: ÖSSZEGZÉS
:: ============================================================================
timeout /t 2 /nobreak >nul
echo  +======================================================================+
echo  ^|  BRUNELLA AGENT SYSTEM — MINDEN KOMPONENS ELINDITVA               ^|
echo  +======================================================================+
echo.
echo   Szolgaltatasok:
echo    Dashboard   : http://localhost:5173  (React + Vite)
echo    Backend     : http://localhost:3000  (MCP + REST + ZeroPrompt + Ephemeral)
echo    Python API  : http://localhost:8000  (FastAPI + Uvicorn + RAG + LanceDB)
echo    Ollama      : http://localhost:11434 (gemma4:e4b + qwen2.5-coder:7b)
echo    AnythingLLM : http://localhost:3001  (GitHub Models gpt-4.1)
echo.
echo   MCP Szerverek (Copilot CLI PAIOS Orchestrator):
echo    brunella-core   ^| 53 MCP tool — teljes BAS hozzaferes
echo    filesystem      ^| workspace fajlrendszer hozzaferes
echo    windows_bridge  ^| natív PowerShell automatizalas
echo.
echo   Level-5 Retegek:
echo    Zero-Prompt AI  ^| /api/zero-prompt/* + GitHub polling aktiv
echo    Ephemeral Agents^| /api/ephemeral/* REST API + spawn_ephemeral_agent MCP tool
echo    Federated MCP   ^| /api/federation/* + capabilities/execute endpoint
echo    Learning Loop   ^| LanceDB telemetria + nightly_trainer.py
echo.

:: Böngészők megnyitása
start http://localhost:5173
timeout /t 1 /nobreak >nul
start http://localhost:3000/api/health

echo   A rendszer kb. 15-30 mp alatt all teljesen keszre.
echo   Nyomd meg barmelyik billentyut a bezarashoz (a szolgaltatasok tovabb futnak).
echo.
pause