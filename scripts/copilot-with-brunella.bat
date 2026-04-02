@echo off
REM Wrapper to ensure Brunella is running before launching Copilot CLI
SET SCRIPT_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%copilot-with-brunella.ps1" -McpUrl "http://localhost:3000/readyz" -StartCmd "inditas.bat" %*
