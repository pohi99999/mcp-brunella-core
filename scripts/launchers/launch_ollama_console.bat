@echo off
chcp 65001 >nul 2>&1
title BAS ^| Ollama :11434
C:
echo [BAS] Ollama konzol inditasa...
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    ollama serve
    goto :eof
)

set "OLLAMA_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\Ollama\ollama app.exe"
if exist "%OLLAMA_EXE%" (
    echo [BAS] Az ollama CLI nem erheto el, megnyitom az Ollama alkalmazast...
    start "" "%OLLAMA_EXE%"
    echo [BAS] Ha az API nem all fel, telepitsd vagy add PATH-hoz az ollama CLI-t.
) else (
    echo [BAS] HIBA: Ollama nem talalhato.
    echo Telepites: https://ollama.com/download
)

echo.
echo Ez az ablak nyitva marad referencia celra.