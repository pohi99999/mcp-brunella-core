@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Brunella Agent System - Canonical Stable Launcher

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

set "CORE_READY_URL=http://localhost:3000/readyz"
set "DASHBOARD_URL=http://localhost:3000"

echo.
echo  +======================================================================+
echo  ^|   BRUNELLA AGENT SYSTEM - STABLE MANUAL ENTRYPOINT                  ^|
echo  ^|   Windows service ha elerheto, egyebkent stable console fallback    ^|
echo  +======================================================================+
echo.

sc query "BrunellaCore" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
  echo [1/3] Windows service mod eszlelve - BrunellaCore inditasa...
  sc start "BrunellaCore" >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    echo    [OK] BrunellaCore service inditva vagy mar fut.
  ) else (
    echo    [--] BrunellaCore service mar fut vagy keszenleti allapotban van.
  )

  echo [2/3] Ready allapot varakozasa...
  set /a ATTEMPTS=0
  :wait_service_ready
  curl -s --max-time 2 "%CORE_READY_URL%" >nul 2>&1
  if !ERRORLEVEL! EQU 0 goto service_ready
  if !ATTEMPTS! GEQ 20 goto service_timeout
  set /a ATTEMPTS+=1
  timeout /t 2 >nul
  goto wait_service_ready

  :service_ready
  echo    [OK] Brunella Core ready.
  goto open_dashboard

  :service_timeout
  echo    [--] Ready timeout. Megnyitom a dashboardot, de a service meg indulhat.
  goto open_dashboard
)

echo [1/3] Windows service nincs telepitve - stable console fallback indul...
call "%PROJECT_ROOT%\Inditsd_Brunellat_Stabil.bat" %*
exit /b %ERRORLEVEL%

:open_dashboard
echo [3/3] Dashboard megnyitasa...
start "" "%DASHBOARD_URL%"
exit /b 0
