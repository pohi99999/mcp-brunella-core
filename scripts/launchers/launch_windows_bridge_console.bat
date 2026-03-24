@echo off
chcp 65001 >nul 2>&1
title BAS ^| Windows Bridge
C:
set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%\windows_bridge"
echo [BAS] Windows Automation Bridge inditasa...
call run_bridge.bat