@echo off
chcp 65001 >nul 2>&1
title BAS ^| AnythingLLM :3001
C:
set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
echo [BAS] AnythingLLM inditasa...

if exist "%ROOT%\AnythingLLM\server\index.js" (
    cd /d "%ROOT%\AnythingLLM"
    npm start
    goto :eof
)

if exist "C:\Program Files\AnythingLLM\AnythingLLM.exe" (
    echo [BAS] Lokalis repo nem talalhato, megnyitom az AnythingLLM alkalmazast...
    start "" "C:\Program Files\AnythingLLM\AnythingLLM.exe"
    goto :eof
)

if exist "C:\Users\%USERNAME%\AppData\Local\AnythingLLM\AnythingLLM.exe" (
    echo [BAS] Lokalis repo nem talalhato, megnyitom az AnythingLLM alkalmazast...
    start "" "C:\Users\%USERNAME%\AppData\Local\AnythingLLM\AnythingLLM.exe"
    goto :eof
)

echo [BAS] HIBA: AnythingLLM sem lokalis repo-bol, sem telepitett alkalmazaskent nem talalhato.
echo Ellenorizd a telepitest vagy a %ROOT%\AnythingLLM mappat.