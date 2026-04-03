@echo off
echo Starting Windows Automation Bridge...
cd %~dp0

REM HTTP health szerver indítása háttérben (port 3002)
start "WAB-Health" /B python wab_health.py --port 3002

REM MCP stdio szerver indítása (fő folyamat)
python wab_server.py
