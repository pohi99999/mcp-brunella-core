@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-agent-chrome.ps1"
exit /b %ERRORLEVEL%
