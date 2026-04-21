@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title BRUNELLA AGENT SYSTEM - Entry Point

:: This script is a simple entry point that delegates to specialized scripts in ops/bootstrap/

echo.
echo  ================================================================
echo        BRUNELLA AGENT SYSTEM - Main Launcher
echo  ================================================================
echo.
echo  [1] Master Start (Full Orchestration)
echo  [2] Dashboard ^& Stable Console
echo  [3] Full System (All components)
echo  [4] Sync ^& Update (GitHub)
echo  [5] Exit
echo.

choice /C 12345 /M "Select a launch option:"

if %ERRORLEVEL% EQU 1 (
    call "%~dp0ops\bootstrap\BRUNELLA_START.bat"
) else if %ERRORLEVEL% EQU 2 (
    call "%~dp0ops\bootstrap\inditas.bat"
) else if %ERRORLEVEL% EQU 3 (
    call "%~dp0ops\bootstrap\start-full.bat"
) else if %ERRORLEVEL% EQU 4 (
    call "%~dp0ops\scripts\github-sync.bat"
) else if %ERRORLEVEL% EQU 5 (
    exit /b 0
)

pause
