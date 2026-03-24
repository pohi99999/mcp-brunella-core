@echo off
setlocal
chcp 65001 >nul 2>&1
title BRUNELLA - LATHATO MULTI-CONSOLE INDITAS

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"
set "STARTED_ANY=0"

echo.
echo  +========================================================================+
echo  ^|                                                                        ^|
echo  ^|        BRUNELLA AGENT SYSTEM  --  LATHATO TELJES INDITAS              ^|
echo  ^|                                                                        ^|
echo  +========================================================================+
echo.
echo  Projekt: %ROOT%
echo  Ido    : %DATE% %TIME%
echo.

echo  [0/7] FOSZAL szinkron (opcionalis)...
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "%ROOT%\scripts\sync_foszal.py" (
        python "%ROOT%\scripts\sync_foszal.py" >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo    [OK] FOSZAL.md frissitve.
        ) else (
            echo    [--] FOSZAL szinkron kihagyva ^(hiba kozben^).
        )
    ) else (
        echo    [--] sync_foszal.py nem talalhato.
    )
) else (
    echo    [--] Python nincs a PATH-ban, FOSZAL szinkron kihagyva.
)
echo.

echo  [1/7] Ollama ellenorzese...
curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Ollama mar fut - http://localhost:11434
) else (
    echo    [..] Ollama inditasa kulon konzolban...
    set "STARTED_ANY=1"
    start "BAS | Ollama :11434" cmd /k call "%ROOT%\scripts\launchers\launch_ollama_console.bat"
)
echo.

echo  [2/7] AnythingLLM ellenorzese...
curl -s --max-time 2 http://localhost:3001/api/ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    [OK] AnythingLLM mar fut - http://localhost:3001
) else (
    echo    [..] AnythingLLM inditasa kulon ablakban...
    set "STARTED_ANY=1"
    start "BAS | AnythingLLM :3001" cmd /k call "%ROOT%\scripts\launchers\launch_anythingllm_console.bat"
)
echo.

echo  [3/7] Windows Automation Bridge ellenorzese...
call :is_bridge_running
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Windows Bridge mar fut vagy eppen indul.
) else (
    echo    [..] Windows Bridge inditasa kulon konzolban...
    set "STARTED_ANY=1"
    start "BAS | Windows Bridge" cmd /k call "%ROOT%\scripts\launchers\launch_windows_bridge_console.bat"
)
echo.

echo  [4/7] Python FastAPI backend ellenorzese...
curl -s --max-time 2 http://localhost:8000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Python API mar fut - http://localhost:8000
) else (
    echo    [..] Python FastAPI inditasa kulon konzolban...
    set "STARTED_ANY=1"
    start "BAS | Python FastAPI :8000" cmd /k call "%ROOT%\scripts\launchers\launch_python_api_console.bat"
)
echo.

echo  [5/7] Node.js backend ellenorzese...
curl -s --max-time 2 http://localhost:3000/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Backend mar fut - http://localhost:3000
) else (
    echo    [..] Node.js backend inditasa kulon konzolban...
    set "STARTED_ANY=1"
    start "BAS | Node.js Backend :3000" cmd /k call "%ROOT%\scripts\launchers\launch_backend_console.bat"
)
echo.

echo  [6/7] Dashboard UI ellenorzese...
call :is_dashboard_running
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Dashboard mar fut - http://localhost:5173
) else (
    echo    [..] Dashboard UI inditasa kulon konzolban...
    set "STARTED_ANY=1"
    start "BAS | Dashboard UI :5173" cmd /k call "%ROOT%\scripts\launchers\launch_dashboard_console.bat"
)
echo.

echo  [7/7] Varakozas es gyors osszefoglalo...
timeout /t 8 /nobreak >nul
echo.
echo  +------------------------------------------+
echo  ^|  RENDSZER ALLAPOT                        ^|
echo  +------------------------------------------+
curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo  ^|  [OK] Ollama      http://localhost:11434  ^|) else (echo  ^|  [..] Ollama      indul / ellenorizd    ^|)
curl -s --max-time 2 http://localhost:3001/api/ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo  ^|  [OK] AnythingLLM http://localhost:3001   ^|) else (echo  ^|  [..] AnythingLLM indul / ellenorizd    ^|)
curl -s --max-time 2 http://localhost:8000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo  ^|  [OK] Python API  http://localhost:8000   ^|) else (echo  ^|  [..] Python API  indul / ellenorizd    ^|)
curl -s --max-time 2 http://localhost:3000/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo  ^|  [OK] Backend     http://localhost:3000   ^|) else (echo  ^|  [..] Backend     indul / ellenorizd    ^|)
curl -s --max-time 2 http://localhost:5173 >nul 2>&1
if %ERRORLEVEL% EQU 0 (echo  ^|  [OK] Dashboard   http://localhost:5173   ^|) else (echo  ^|  [..] Dashboard   indul / ellenorizd    ^|)
echo  +------------------------------------------+
echo.

if /I not "%BRUNELLA_NO_BROWSER%"=="1" (
    start http://localhost:5173
)

if "%STARTED_ANY%"=="1" (
    echo  Kulon ablakok nyiltak meg a hianyzo szolgaltatasokhoz.
    echo  A mar futo szolgaltatasokhoz nem nyitottam uj peldanyt.
) else (
    echo  Minden szukseges szolgaltatas mar futott.
    echo  Nem nyitottam uj konzolablakot.
)
echo.
if defined BRUNELLA_NO_PAUSE goto end_launcher
echo  Nyomj Enter-t a launcher bezarasahoz...
pause >nul
:end_launcher
endlocal
exit /b 0

:is_bridge_running
tasklist /V /FI "IMAGENAME eq cmd.exe" 2>nul | findstr /I /C:"BAS | Windows Bridge" >nul
if %ERRORLEVEL% EQU 0 exit /b 0
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*wab_server.py*') -or ($_.CommandLine -like '*launch_windows_bridge_console.bat*') }; if ($p) { exit 0 } else { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:is_dashboard_running
curl -s --max-time 2 http://localhost:5173 >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0
tasklist /V /FI "IMAGENAME eq cmd.exe" 2>nul | findstr /I /C:"BAS | Dashboard UI :5173" >nul
if %ERRORLEVEL% EQU 0 exit /b 0
powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*launch_dashboard_console.bat*') -or ($_.CommandLine -like '*vite src/dashboard*') }; if ($p) { exit 0 } else { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%
