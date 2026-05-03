@echo off
setlocal
cd /d "%~dp0"

set "DASHBOARD_URL=http://localhost:5173"
if not defined ANYTHINGLLM_EXE set "ANYTHINGLLM_EXE=C:\Program Files\AnythingLLM\AnythingLLM.exe"
if not defined OLLAMA_BASE_URL set "OLLAMA_BASE_URL=http://127.0.0.1:11434"
if not defined ANYTHINGLLM_BASE_URL set "ANYTHINGLLM_BASE_URL=http://localhost:3001"
if not exist logs mkdir logs

TITLE BRUNELLA PHASE 5 UNIFIED LAUNCHER

echo ======================================================
echo          BRUNELLA AGENT SYSTEM - DASHBOARD
echo ======================================================
echo.

echo [1/7] PREFLIGHT: Runtime workspace...
if /I "%~1"=="--sync-docs" (
    echo    - Syncing documentation...
    call npm run sync:docs
    if %ERRORLEVEL% NEQ 0 (
        echo [WARN] Documentation sync failed, continuing...
    )
) else (
    echo    - Skipping docs sync. Use dashboard.bat --sync-docs to enable.
)
call npm run mcp:validate
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] MCP config validation failed. Dashboard can start, but MCP tools may be unavailable.
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
    start "Brunella-Python" cmd /d /c "npm run start:python:stable <NUL >>logs\python-server.log 2>&1"
)

echo [5/7] CHECK: Node Core server (Port 3000)...
call :IsPortListening 3000
if not errorlevel 1 (
    echo    - Core API already running on port 3000, skipping second instance.
) else (
    echo    - Starting Core API...
    start "Brunella-Core" cmd /d /c "set BRUNELLA_WEB_ONLY=1&& npm run dev <NUL >>logs\node-server.log 2>&1"
)

echo [6/7] CHECK: Dashboard UI (Port 5173)...
call :IsPortListening 5173
if not errorlevel 1 (
    echo    - Dashboard already running on port 5173, skipping second instance.
) else (
    echo    - Starting Dashboard on fixed port 5173...
    start "Brunella-Dashboard" cmd /d /c "npm run dev:ui -- --host 0.0.0.0 --port 5173 --strictPort <NUL >>logs\vite-dashboard.log 2>&1"
)

echo.
echo [7/7] SMOKE CHECK: Verifying services are alive...
echo    - Waiting up to 60s for endpoints to respond...
set "SMOKE_FAILED="
call :WaitHttpBody "Core live    " "http://localhost:3000/ping"          30 "pong" || set "SMOKE_FAILED=1"
call :WaitReadyJson "Core ready   " "http://localhost:3000/readyz"       120 || set "SMOKE_FAILED=1"
call :WaitHealthJson "Core health  " "http://localhost:3000/api/v1/health" 60 || set "SMOKE_FAILED=1"
call :WaitProviderConfig "LLM config   " "http://localhost:3000/api/v1/providers/config" 30 || set "SMOKE_FAILED=1"
call :WaitHttp "Python (8000)" "http://localhost:8000/health"         60 || set "SMOKE_FAILED=1"
call :WaitHttp "Dashboard    " "http://localhost:5173"                60 || set "SMOKE_FAILED=1"
call :WaitHttp "Ollama      " "%OLLAMA_BASE_URL%/api/tags"            60 || set "SMOKE_FAILED=1"
call :WaitOllamaModels "%OLLAMA_BASE_URL%/api/tags" 60 || echo [WARN] Ollama is reachable but no models were listed.
call :WaitHttp "AnythingLLM " "%ANYTHINGLLM_BASE_URL%/api/ping"       60 || echo [WARN] AnythingLLM API not reachable at %ANYTHINGLLM_BASE_URL%

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

:WaitHttpBody
:: %~1 = label, %~2 = url, %~3 = timeout seconds, %~4 = expected body substring
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~3'); $u='%~2'; $label='%~1'; $needle='%~4';" ^
  "while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; if ($r.StatusCode -eq 200 -and $r.Content -like ('*' + $needle + '*')) { Write-Host ('   - [OK]   ' + $label + ' -> ' + $u); exit 0 } } catch {}; Start-Sleep -Milliseconds 750 }" ^
  "Write-Host ('   - [FAIL] ' + $label + ' -> ' + $u + ' did not return expected body in ' + '%~3' + 's'); exit 1"
exit /b %ERRORLEVEL%

:WaitReadyJson
:: %~1 = label, %~2 = url, %~3 = timeout seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~3'); $u='%~2'; $label='%~1';" ^
  "while ((Get-Date) -lt $deadline) { try { $j = Invoke-RestMethod -Uri $u -TimeoutSec 3 -ErrorAction Stop; if ($j.ready -eq $true -and $j.status -eq 'ready') { Write-Host ('   - [OK]   ' + $label + ' -> ' + $u); exit 0 } } catch {}; Start-Sleep -Milliseconds 750 }" ^
  "Write-Host ('   - [FAIL] ' + $label + ' -> ' + $u + ' was not ready in ' + '%~3' + 's'); exit 1"
exit /b %ERRORLEVEL%

:WaitHealthJson
:: %~1 = label, %~2 = url, %~3 = timeout seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~3'); $u='%~2'; $label='%~1';" ^
  "while ((Get-Date) -lt $deadline) { try { $j = Invoke-RestMethod -Uri $u -TimeoutSec 5 -ErrorAction Stop; if ($j.services -and $j.services.python -and $j.services.mcp -and $j.services.agents) { Write-Host ('   - [OK]   ' + $label + ' -> ' + $u + ' status=' + $j.status); exit 0 } } catch {}; Start-Sleep -Milliseconds 750 }" ^
  "Write-Host ('   - [FAIL] ' + $label + ' -> ' + $u + ' did not expose expected health JSON in ' + '%~3' + 's'); exit 1"
exit /b %ERRORLEVEL%

:WaitProviderConfig
:: %~1 = label, %~2 = url, %~3 = timeout seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~3'); $u='%~2'; $label='%~1';" ^
  "while ((Get-Date) -lt $deadline) { try { $j = Invoke-RestMethod -Uri $u -TimeoutSec 5 -ErrorAction Stop; if ($j.hasLocal -eq $true) { Write-Host ('   - [OK]   ' + $label + ' -> local=' + $j.hasLocal + ' cloudFallback=' + $j.hasCloudFallback); exit 0 } } catch {}; Start-Sleep -Milliseconds 750 }" ^
  "Write-Host ('   - [FAIL] ' + $label + ' -> provider config unavailable in ' + '%~3' + 's'); exit 1"
exit /b %ERRORLEVEL%

:WaitOllamaModels
:: %~1 = url, %~2 = timeout seconds
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds([int]'%~2'); $u='%~1';" ^
  "while ((Get-Date) -lt $deadline) { try { $j = Invoke-RestMethod -Uri $u -TimeoutSec 5 -ErrorAction Stop; if ($j.models -and $j.models.Count -gt 0) { Write-Host ('   - [OK]   Ollama models -> ' + $j.models.Count); exit 0 } } catch {}; Start-Sleep -Milliseconds 750 }" ^
  "exit 1"
exit /b %ERRORLEVEL%
