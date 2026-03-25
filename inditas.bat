@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title BRUNELLA AGENT SYSTEM - TELJES INDITAS

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo  +========================================================================+
echo  ^|                                                                        ^|
echo  ^|   BRUNELLA AGENT SYSTEM  -  TELJES INDITAS (LATHATO KONZOLOKKAL)      ^|
echo  ^|                                                                        ^|
echo  +========================================================================+
echo.
echo  Projekt: %ROOT%
echo  Ido    : %DATE% %TIME%
echo.

:: =========================================================================
:: [1/9] GITHUB SZINKRONIZACIO (fetch + pull + Jules PR check)
:: =========================================================================
echo  [1/9] GitHub szinkronizacio...
where git >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    git fetch origin >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] Git fetch kész.
        :: Pull ha nincs uncommitted change
        git diff --quiet >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            git pull origin main --ff-only >nul 2>&1
            if !ERRORLEVEL! EQU 0 (
                echo    [OK] Git pull kész ^(fast-forward^).
            ) else (
                echo    [!!] Git pull nem sikerult ^(merge conflict?^). Kézi merge szukseges.
            )
        ) else (
            echo    [--] Uncommitted valtozasok vannak, pull kihagyva.
        )
    ) else (
        echo    [!!] Git fetch nem sikerult ^(nincs halozat?^).
    )

    :: Jules PR check
    where gh >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        for /f %%c in ('gh pr list --state open --limit 10 --json number 2^>nul ^| findstr /c:"number" ^| find /c "number"') do set "PR_COUNT=%%c"
        if defined PR_COUNT if !PR_COUNT! GTR 0 (
            echo    [!!] !PR_COUNT! nyitott PR talalhato ^(Jules?^). Ellenorizd: gh pr list
        ) else (
            echo    [OK] Nincs nyitott PR.
        )
    ) else (
        echo    [--] GitHub CLI ^(gh^) nem elerheto, Jules PR check kihagyva.
    )
) else (
    echo    [--] Git nem talalhato, szinkron kihagyva.
)
echo.

:: =========================================================================
:: [2/9] DOKUMENTACIO FRISSITES
:: =========================================================================
echo  [2/9] Dokumentaciok frissitese...

:: FOSZAL naplo frissites
where python >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    if exist "%ROOT%\scripts\sync_foszal.py" (
        python "%ROOT%\scripts\sync_foszal.py" >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo    [OK] FOSZAL.md frissitve.
        ) else (
            echo    [--] FOSZAL szinkron hiba ^(nem kritikus^).
        )
    )

    :: Conductor szinkron
    if exist "%ROOT%\scripts\sync_conductor.py" (
        python "%ROOT%\scripts\sync_conductor.py" >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            echo    [OK] conductor/tracks.md frissitve.
        ) else (
            echo    [--] Conductor szinkron hiba ^(nem kritikus^).
        )
    )
) else (
    echo    [--] Python nem talalhato, dokumentacio szinkron kihagyva.
)

:: Master Context frissites
if exist "%ROOT%\scripts\update_master_context.ts" (
    call npx tsx "%ROOT%\scripts\update_master_context.ts" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo    [OK] BRUNELLA_MASTER_CONTEXT.md generalva.
    ) else (
        echo    [--] Master context frissites kihagyva.
    )
)
echo.

:: =========================================================================
:: [3/9] OLLAMA (AI Motor)
:: =========================================================================
echo  [3/9] Ollama ellenorzese...
curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Ollama mar fut - http://localhost:11434
) else (
    echo    [..] Ollama inditasa kulon konzolban...
    start "BAS | Ollama :11434" cmd /k call "%ROOT%\scripts\launchers\launch_ollama_console.bat"
)
echo.

:: =========================================================================
:: [4/9] ANYTHINGLLM
:: =========================================================================
echo  [4/9] AnythingLLM ellenorzese...
curl -s --max-time 2 http://localhost:3001/api/ping >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] AnythingLLM mar fut - http://localhost:3001
) else (
    echo    [..] AnythingLLM inditasa...
    start "BAS | AnythingLLM :3001" cmd /k call "%ROOT%\scripts\launchers\launch_anythingllm_console.bat"
)
echo.

:: =========================================================================
:: [5/9] WINDOWS AUTOMATION BRIDGE
:: =========================================================================
echo  [5/9] Windows Automation Bridge ellenorzese...
call :is_bridge_running
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Windows Bridge mar fut.
) else (
    echo    [..] Windows Bridge inditasa kulon konzolban...
    start "BAS | Windows Bridge" cmd /k call "%ROOT%\scripts\launchers\launch_windows_bridge_console.bat"
)
echo.

:: =========================================================================
:: [6/9] PYTHON FASTAPI BACKEND
:: =========================================================================
echo  [6/9] Python FastAPI backend ellenorzese...
curl -s --max-time 2 http://localhost:8000/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Python API mar fut - http://localhost:8000
) else (
    echo    [..] Python FastAPI inditasa kulon konzolban...
    start "BAS | Python FastAPI :8000" cmd /k call "%ROOT%\scripts\launchers\launch_python_api_console.bat"
)
echo.

:: =========================================================================
:: [7/9] NODE.JS BACKEND (npm run dev — LATHATO LOGOKKAL)
:: =========================================================================
echo  [7/9] Node.js backend ellenorzese...
curl -s --max-time 2 http://localhost:3000/api/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Backend mar fut - http://localhost:3000
) else (
    echo    [..] Node.js backend inditasa LATHATO konzolban...
    start "BAS | Node.js Backend :3000" cmd /k call "%ROOT%\scripts\launchers\launch_backend_console.bat"
)
echo.

:: =========================================================================
:: [8/9] DASHBOARD UI (npm run dev:ui)
:: =========================================================================
echo  [8/9] Dashboard UI ellenorzese...
call :is_dashboard_running
if !ERRORLEVEL! EQU 0 (
    echo    [OK] Dashboard mar fut - http://localhost:5173
) else (
    echo    [..] Dashboard UI inditasa kulon konzolban...
    start "BAS | Dashboard UI :5173" cmd /k call "%ROOT%\scripts\launchers\launch_dashboard_console.bat"
)
echo.

:: =========================================================================
:: [9/9] HEALTH CHECK + OSSZESITES
:: =========================================================================
echo  [9/9] Varakozas a szolgaltatasok indulasara (15 mp)...
timeout /t 15 /nobreak >nul
echo.
echo  +--------------------------------------------------+
echo  ^|  RENDSZER ALLAPOT                                ^|
echo  +--------------------------------------------------+

curl -s --max-time 3 http://localhost:11434/api/tags >nul 2>&1
if !ERRORLEVEL! EQU 0 (echo  ^|  [OK] Ollama       http://localhost:11434  ^|) else (echo  ^|  [..] Ollama       indul / ellenorizd     ^|)

curl -s --max-time 3 http://localhost:3001/api/ping >nul 2>&1
if !ERRORLEVEL! EQU 0 (echo  ^|  [OK] AnythingLLM  http://localhost:3001   ^|) else (echo  ^|  [..] AnythingLLM  indul / ellenorizd     ^|)

curl -s --max-time 3 http://localhost:8000/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (echo  ^|  [OK] Python API   http://localhost:8000   ^|) else (echo  ^|  [..] Python API   indul / ellenorizd     ^|)

curl -s --max-time 3 http://localhost:3000/api/health >nul 2>&1
if !ERRORLEVEL! EQU 0 (echo  ^|  [OK] Backend      http://localhost:3000   ^|) else (echo  ^|  [..] Backend      indul / ellenorizd     ^|)

curl -s --max-time 3 http://localhost:5173 >nul 2>&1
if !ERRORLEVEL! EQU 0 (echo  ^|  [OK] Dashboard    http://localhost:5173   ^|) else (echo  ^|  [..] Dashboard    indul / ellenorizd     ^|)

echo  +--------------------------------------------------+
echo.
echo  Hasznos parancsok:
echo    brunella chat          - Interaktiv chat
echo    brunella agents        - Ugynoklistak
echo    brunella conductor status - Projekt statusz
echo    npm run test:fast      - Gyors tesztek
echo.

:: Bongeszo megnyitasa
if /I not "%BRUNELLA_NO_BROWSER%"=="1" (
    start http://localhost:5173
)

echo  Nyomj Enter-t a launcher bezarasahoz...
pause >nul
endlocal
exit /b 0

:: =========================================================================
:: HELPER FUGGVENYEK
:: =========================================================================

:is_bridge_running
tasklist /V /FI "IMAGENAME eq cmd.exe" 2>nul | findstr /I /C:"BAS | Windows Bridge" >nul
if !ERRORLEVEL! EQU 0 exit /b 0
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*wab_server.py*') -or ($_.CommandLine -like '*launch_windows_bridge_console.bat*') }; if ($p) { exit 0 } else { exit 1 }" >nul 2>&1
exit /b !ERRORLEVEL!

:is_dashboard_running
curl -s --max-time 2 http://localhost:5173 >nul 2>&1
if !ERRORLEVEL! EQU 0 exit /b 0
tasklist /V /FI "IMAGENAME eq cmd.exe" 2>nul | findstr /I /C:"BAS | Dashboard UI :5173" >nul
if !ERRORLEVEL! EQU 0 exit /b 0
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*launch_dashboard_console.bat*') -or ($_.CommandLine -like '*vite src/dashboard*') }; if ($p) { exit 0 } else { exit 1 }" >nul 2>&1
exit /b !ERRORLEVEL!
