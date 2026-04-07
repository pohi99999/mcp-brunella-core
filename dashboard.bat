@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Brunella Dashboard Launcher

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

if not exist "%PROJECT_ROOT%\logs" mkdir "%PROJECT_ROOT%\logs" >nul 2>&1

set "OLLAMA_URL=http://127.0.0.1:11434/api/tags"
set "PYTHON_URL=http://127.0.0.1:8000/health"
set "BACKEND_PING_URL=http://127.0.0.1:3000/ping"
set "BACKEND_READY_URL=http://127.0.0.1:3000/readyz"
set "API_READY_URL=http://127.0.0.1:3000/api/v1/health/ready"
set "TOOLS_URL=http://127.0.0.1:3000/api/v1/tools/registry"
set "UI_URL=http://127.0.0.1:5173"

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║    🤖 BRUNELLA AGENT SYSTEM - Dashboard Ready Start      ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

echo [0/7] Elofeltetelek ellenorzese...
call :require_command curl "A Windows curl nem erheto el."
if errorlevel 1 goto :fail
call :require_command node "Node.js nincs telepitve vagy nincs a PATH-ban."
if errorlevel 1 goto :fail
call :require_command npm "npm nincs telepitve vagy nincs a PATH-ban."
if errorlevel 1 goto :fail

if not exist "%PROJECT_ROOT%\node_modules" (
    echo       ✗ A node_modules hianyzik. Futtasd egyszer: npm install
    goto :fail
)
if not exist "%PROJECT_ROOT%\myai" (
    echo       ✗ A myai konyvtar nem talalhato.
    goto :fail
)
echo       ✓ Az alap tooling elerheto

echo.
echo [1/7] Ollama ellenorzes (:11434)...
call :check_url "%OLLAMA_URL%"
if errorlevel 1 (
    echo       → Ollama nem fut. Inditom...
    call :start_ollama
    if errorlevel 1 goto :fail
    call :wait_for_url "%OLLAMA_URL%" 20
    if errorlevel 1 (
        echo       ✗ Ollama nem valt elerhetove 20 mp alatt.
        goto :fail
    )
    echo       ✓ Ollama kesz
) else (
    echo       ✓ Ollama mar fut
)

echo.
echo [2/7] Python FastAPI ellenorzes (:8000)...
call :check_url "%PYTHON_URL%"
if errorlevel 1 (
    echo       → FastAPI nem fut. Inditom...
    call :start_python
    if errorlevel 1 goto :fail
    echo       → Varok legfeljebb 60 mp-et a Python health valaszra...
    call :wait_for_url "%PYTHON_URL%" 60
    if errorlevel 1 (
        echo       ✗ A Python FastAPI nem valt elerhetove 60 mp alatt.
        echo       Log: %PROJECT_ROOT%\logs\python-fastapi.log
        goto :fail
    )
    echo       ✓ Python FastAPI kesz
) else (
    echo       ✓ Python FastAPI mar fut
)

echo.
echo [3/7] C# MCP server warmup...
call powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\csharp-mcp-server\launch.ps1" -WarmupOnly > "%PROJECT_ROOT%\logs\csharp-mcp-warmup.log" 2>&1
if errorlevel 1 (
    echo       ✗ A C# MCP server warmup nem sikerult.
    echo       Log: %PROJECT_ROOT%\logs\csharp-mcp-warmup.log
    goto :fail
)
echo       ✓ C# MCP server elokeszitve

echo.
echo [4/7] Node.js backend + core readiness ellenorzes (:3000)...
call :check_url "%BACKEND_READY_URL%"
if errorlevel 1 (
    call :check_url "%BACKEND_PING_URL%"
    if errorlevel 1 (
        echo       → Backend nem fut. Inditom...
        call :clear_stale_backend_lock
        start "Node Backend :3000" /min cmd /c "cd /d ""%PROJECT_ROOT%"" && npm run dev > ""%PROJECT_ROOT%\logs\node-server.log"" 2>&1"
    ) else (
        echo       → Backend mar hallgat, de meg inicializal. Varok...
    )
    echo       → Varok legfeljebb 90 mp-et a backend /readyz allapotra...
    call :wait_for_url "%BACKEND_READY_URL%" 90
    if errorlevel 1 (
        echo       ✗ A backend nem lett ready 90 mp alatt.
        echo       Log: %PROJECT_ROOT%\logs\node-server.log
        goto :fail
    )
    echo       ✓ Backend readyz kesz
) else (
    echo       ✓ Backend mar ready
)

echo.
echo [5/7] API route-ok, tool registry es MCP auto-start stabilizalasa...
echo       → Varok legfeljebb 30 mp-et az API health ready endpointre...
call :wait_for_url "%API_READY_URL%" 30
if errorlevel 1 (
    echo       ✗ Az API health ready endpoint nem valt elerhetove.
    echo       Log: %PROJECT_ROOT%\logs\node-server.log
    goto :fail
)
echo       → Varok legfeljebb 30 mp-et a tool registry route-ra...
call :wait_for_url "%TOOLS_URL%" 30
if errorlevel 1 (
    echo       ✗ A tool registry nem valt elerhetove.
    echo       Log: %PROJECT_ROOT%\logs\node-server.log
    goto :fail
)
echo       → Adok meg 5 mp-et az MCP auto-start folyamatoknak...
timeout /t 5 /nobreak >nul
echo       ✓ API es tool registry kesz

echo.
echo [6/7] Dashboard UI ellenorzes (:5173)...
call :check_url "%UI_URL%"
if errorlevel 1 (
    echo       → Vite UI nem fut. Inditom...
    start "Dashboard UI :5173" /min cmd /c "cd /d ""%PROJECT_ROOT%"" && npm run dev:ui > ""%PROJECT_ROOT%\logs\vite-ui.log"" 2>&1"
    echo       → Varok legfeljebb 60 mp-et a Vite UI-ra...
    call :wait_for_url "%UI_URL%" 60
    if errorlevel 1 (
        echo       ✗ A Dashboard UI nem valt elerhetove 60 mp alatt.
        echo       Log: %PROJECT_ROOT%\logs\vite-ui.log
        goto :fail
    )
    echo       ✓ Dashboard UI kesz
) else (
    echo       ✓ Dashboard UI mar fut
)

echo.
echo [7/7] Vegso ellenorzes es dashboard megnyitasa...
echo.
echo  ┌─────────────────────────────────────────────────┐
echo  │             CRITICAL SERVICES STATUS            │
echo  └─────────────────────────────────────────────────┘

set "ALL_OK=1"
call :print_status "Ollama" "%OLLAMA_URL%"
if errorlevel 1 set "ALL_OK=0"
call :print_status "Python FastAPI" "%PYTHON_URL%"
if errorlevel 1 set "ALL_OK=0"
call :print_status "Backend readyz" "%BACKEND_READY_URL%"
if errorlevel 1 set "ALL_OK=0"
call :print_status "API ready" "%API_READY_URL%"
if errorlevel 1 set "ALL_OK=0"
call :print_status "Tool registry" "%TOOLS_URL%"
if errorlevel 1 set "ALL_OK=0"
call :print_status "Dashboard UI" "%UI_URL%"
if errorlevel 1 set "ALL_OK=0"

if not "%ALL_OK%"=="1" (
    echo.
    echo  ✗ Nem minden kritikus komponens erheto el. A bongeszo nem nyilik meg automatikusan.
    goto :fail
)

if /I not "%BRUNELLA_DASHBOARD_NO_BROWSER%"=="1" (
    start "" "http://localhost:5173"
)

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   ✅ Brunella dashboard most mar munkakesz allapotban van ║
echo  ║                                                          ║
echo  ║   Dashboard:  http://localhost:5173                      ║
echo  ║   Backend:    http://localhost:3000/readyz               ║
echo  ║   API:        http://localhost:3000/api/v1/health        ║
echo  ║   FastAPI:    http://localhost:8000/docs                 ║
echo  ║   Ollama:     http://localhost:11434                     ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Tipp: ha nem akarod automatikusan megnyitni a bongeszot,
echo       inditsd igy: set BRUNELLA_DASHBOARD_NO_BROWSER=1 ^&^& dashboard.bat
echo.
pause
exit /b 0

:require_command
where %~1 >nul 2>&1
if errorlevel 1 (
    echo       ✗ %~2
    exit /b 1
)
exit /b 0

:check_url
curl -fsS --max-time 1 "%~1" >nul 2>&1
exit /b %errorlevel%

:wait_for_url
set "WAIT_URL=%~1"
set /a WAIT_LIMIT=%~2
for /l %%i in (1,1,%WAIT_LIMIT%) do (
    call :check_url "%WAIT_URL%"
    if !errorlevel! equ 0 exit /b 0
    timeout /t 1 /nobreak >nul
)
exit /b 1

:clear_stale_backend_lock
if exist "%PROJECT_ROOT%\.brunella.pid" (
    set /p OLD_PID=<"%PROJECT_ROOT%\.brunella.pid"
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find /I "node.exe" >nul 2>&1
    if !errorlevel! equ 0 (
        echo       → Bent maradt Brunella lock (PID !OLD_PID!^). A regi node folyamat leallitasa...
        taskkill /F /PID !OLD_PID! >nul 2>&1
        timeout /t 2 /nobreak >nul
    ) else (
        echo       → Elavult .brunella.pid torlese...
    )
    del /F /Q "%PROJECT_ROOT%\.brunella.pid" >nul 2>&1
)
exit /b 0

:start_ollama
where ollama >nul 2>&1
if !errorlevel! equ 0 (
    start "Ollama" /min cmd /c "ollama serve > ""%PROJECT_ROOT%\logs\ollama.log"" 2>&1"
    exit /b 0
)
if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe" (
    start "" "C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
    exit /b 0
)
echo       ✗ Ollama nincs telepitve vagy nincs a PATH-ban.
exit /b 1

:start_python
where uv >nul 2>&1
if !errorlevel! equ 0 (
    start "Python FastAPI :8000" /min cmd /c "cd /d ""%PROJECT_ROOT%\myai"" && uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload > ""%PROJECT_ROOT%\logs\python-fastapi.log"" 2>&1"
    exit /b 0
)
where uvicorn >nul 2>&1
if !errorlevel! equ 0 (
    start "Python FastAPI :8000" /min cmd /c "cd /d ""%PROJECT_ROOT%\myai"" && uvicorn server:app --host 0.0.0.0 --port 8000 --reload > ""%PROJECT_ROOT%\logs\python-fastapi.log"" 2>&1"
    exit /b 0
)
if exist "%PROJECT_ROOT%\myai\.venv\Scripts\activate.bat" (
    start "Python FastAPI :8000" /min cmd /c "call ""%PROJECT_ROOT%\myai\.venv\Scripts\activate.bat"" && cd /d ""%PROJECT_ROOT%\myai"" && uvicorn server:app --host 0.0.0.0 --port 8000 --reload > ""%PROJECT_ROOT%\logs\python-fastapi.log"" 2>&1"
    exit /b 0
)
if exist "%PROJECT_ROOT%\.venv\Scripts\activate.bat" (
    start "Python FastAPI :8000" /min cmd /c "call ""%PROJECT_ROOT%\.venv\Scripts\activate.bat"" && cd /d ""%PROJECT_ROOT%\myai"" && uvicorn server:app --host 0.0.0.0 --port 8000 --reload > ""%PROJECT_ROOT%\logs\python-fastapi.log"" 2>&1"
    exit /b 0
)
echo       ✗ Nem talalhato uv, uvicorn vagy hasznalhato virtualis kornyezet.
echo       Futtasd egyszer: cd myai ^&^& uv sync
exit /b 1

:print_status
call :check_url "%~2"
if errorlevel 1 (
    echo  ✗ %~1
    exit /b 1
)
echo  ✓ %~1
exit /b 0

:fail
echo.
echo  Ellenorizd a logokat:
echo    - %PROJECT_ROOT%\logs\ollama.log
echo    - %PROJECT_ROOT%\logs\python-fastapi.log
echo    - %PROJECT_ROOT%\logs\node-server.log
echo    - %PROJECT_ROOT%\logs\vite-ui.log
echo.
pause
exit /b 1
