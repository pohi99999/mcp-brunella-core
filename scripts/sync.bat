@echo off
setlocal
cd /d "%~dp0\.."
call ops\scripts\sync.bat %*
