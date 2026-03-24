@echo off
chcp 65001 >nul 2>&1
title BAS ^| Python FastAPI :8000
C:
set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%\myai"
echo [BAS] Python FastAPI inditasa...
uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload