@echo off
setlocal
cd /d "%~dp0"

set "DASHBOARD_URL=http://localhost:5173"
set "ANYTHINGLLM_EXE=C:\Program Files\AnythingLLM\AnythingLLM.exe"

TITLE BRUNELLA PHASE 5 UNIFIED LAUNCHER

echo ======================================================
echo          BRUNELLA AGENT SYSTEM - DASHBOARD
echo ======================================================
echo.

echo [1/7] SYNC: Documentation and structure...
call npm run sync:docs
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Documentation sync failed, continuing...
)

echo [2/7] CHECK: Ollama server...
tasklist /fi "ImageName eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo    - Starting Ollama...
    start /b "" ollama serve
) else (
    echo    - Ollama already running.
)

echo [3/7] CHECK: AnythingLLM Desktop...
tasklist /fi "ImageName eq AnythingLLM.exe" 2>NUL | find /I /N "AnythingLLM.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - AnythingLLM already running.
) else if exist "%ANYTHINGLLM_EXE%" (
    start "AnythingLLM" "%ANYTHINGLLM_EXE%"
    echo    - AnythingLLM Desktop started: %ANYTHINGLLM_EXE%
) else (
    echo [WARN] AnythingLLM Desktop not found at:
    echo        %ANYTHINGLLM_EXE%
    echo        Continuing without AnythingLLM.
)

echo [4/7] CHECK: Python FastAPI backend (Port 8000)...
call :IsPortListening 8000
if not errorlevel 1 (
    echo    - Python already running on port 8000, skipping second instance.
) else (
    echo    - Starting Python backend...
    start /b "Brunella-Python" npm run start:python:stable
)

echo [5/7] CHECK: Node Core server (Port 3000)...
call :IsPortListening 3000
if not errorlevel 1 (
    echo    - Core API already running on port 3000, skipping second instance.
) else (
    echo    - Starting Core API...
    start /b "Brunella-Core" npm run dev
)

echo [6/7] CHECK: Dashboard UI (Port 5173)...
call :IsPortListening 5173
if not errorlevel 1 (
    echo    - Dashboard already running on port 5173, skipping second instance.
) else (
    echo    - Starting Dashboard on fixed port 5173...
    start /b "Brunella-Dashboard" npm run dev:ui -- --host 0.0.0.0 --port 5173 --strictPort
)

echo.
echo [7/7] SMOKE CHECK: Verifying services are alive...
echo    - Waiting up to 60s for endpoints to respond...
set "SMOKE_FAILED="
call :WaitHttp "Core API     " "http://localhost:3000/ping"           60 || set "SMOKE_FAILED=1"
call :WaitHttp "Core API v1  " "http://localhost:3000/api/v1/health"  30 || set "SMOKE_FAILED=1"
call :WaitHttp "Python (8000)" "http://localhost:8000/health"         60 || set "SMOKE_FAILED=1"
call :WaitHttp "Dashboard    " "http://localhost:5173"                60 || set "SMOKE_FAILED=1"

if defined SMOKE_FAILED (
    echo.
    echo [WARN] One or more smoke checks did NOT respond within timeout.
    echo        See logs:
    echo          - logs\node-server.log     (Core API)
    echo          - logs\python-server.log   (Python FastAPI)
    echo          - logs\vite-dashboard.log  (Dashboard, if any)
    echo        Continuing anyway, but the system may not be fully usable.
) else (
    echo.
    echo [OK] All smoke checks passed.
)

echo.
echo [OK] Opening dashboard in default browser...
start "" "%DASHBOARD_URL%"

echo.
echo ======================================================
echo [OK] BRUNELLA SYSTEM READY
echo.
echo [INFO] Dashboard: %DASHBOARD_URL%
echo [INFO] Core API:  http://localhost:3000
echo [INFO] Python:    http://localhost:8000
echo [INFO] Ollama:    http://localhost:11434
echo ======================================================
echo.
echo NOTE: Do not close this window while using the system.
echo Background processes are attached to this session.
echo.
pause
if defined SMOKE_FAILED exit /b 1
exit /b 0

:IsPortListening
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } exit 1" >nul 2>&1
exit /b %ERRORLEVEL%

:WaitHttp
:: %~1 = label, %~2 = url, %~3 = timeout seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~3'); $u='%~2'; $label='%~1'; $ok=$false;" ^
  "while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; if ($r.StatusCode -lt 500) { $ok=$true; break } } catch { Start-Sleep -Milliseconds 750 } }" ^
  "if ($ok) { Write-Host ('   - [OK]   ' + $label + ' -> ' + $u); exit 0 } else { Write-Host ('   - [FAIL] ' + $label + ' -> ' + $u + ' (no response in ' + '%~3' + 's)'); exit 1 }"
exit /b %ERRORLEVEL%
