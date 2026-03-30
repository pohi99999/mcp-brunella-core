@echo off
REM Starts Brunella dev server in a new window and then opens Copilot CLI in another window.
REM Adjust the Copilot CLI command if different (e.g., `brunella` is the interactive CLI command).
REM Build first so the exported tool catalog is current before the CLI starts.
call npm run build
if errorlevel 1 exit /b %errorlevel%
call node scripts\export_registered_tools.mjs
if errorlevel 1 exit /b %errorlevel%

REM Start Brunella dev server in a separate window.
start "Brunella Server" cmd /k "npm run dev"

REM Wait a few seconds for server to initialize (tune as needed).
timeout /t 6 /nobreak >nul

REM Start Copilot CLI (replace with correct command if needed).
start "Copilot CLI" cmd /k "brunella"

REM Note: Ensure dependencies installed and env vars set before running this script.
