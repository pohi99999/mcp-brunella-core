@echo off
chcp 65001 >nul 2>&1
title BAS ^| Node.js Backend :3000
C:
set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%"
echo [BAS] Node.js backend inditasa...
npm run dev