@echo off
chcp 65001 >nul 2>&1
title BAS ^| Dashboard UI :5173
C:
set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%"
echo [BAS] Dashboard UI inditasa...
npm run dev:ui