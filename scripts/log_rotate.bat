@echo off
:: Brunella Log Rotáció
:: Heti futtatásra tervezve (Windows Task Scheduler)
:: Nagy logfájlok (>10MB) archiválása, régi archívumok törlése (>30 nap)

setlocal EnableDelayedExpansion

set "LOGS_DIR=%~dp0..\logs"
set "ARCHIVE_DIR=%LOGS_DIR%\archive"
set "MAX_SIZE_MB=10"
set "KEEP_DAYS=30"

:: Dátum generálás (YYYY-MM-DD)
for /f "tokens=1-3 delims=/" %%a in ('date /t') do (
    set DD=%%a
    set MM=%%b
    set YYYY=%%c
)
for /f "tokens=2 delims= " %%a in ('date /t') do set DATESTR=%%a
:: Biztonságosabb dátum: WMIC
for /f "tokens=1" %%a in ('wmic os get localdatetime ^| find "."') do set DT=%%a
set DATESTR=%DT:~0,4%-%DT:~4,2%-%DT:~6,2%

if not exist "%ARCHIVE_DIR%" mkdir "%ARCHIVE_DIR%"

echo [%DATESTR%] Brunella Log Rotáció indítása...
echo Logs mappa: %LOGS_DIR%
echo Archív mappa: %ARCHIVE_DIR%

:: Nagy fájlok archiválása
for %%F in ("%LOGS_DIR%\*.log") do (
    set "FNAME=%%~nxF"
    set "FPATH=%%~fF"
    set "FSIZE=%%~zF"

    :: Méret MB-ban
    set /a SIZE_MB=!FSIZE! / 1048576

    if !SIZE_MB! GEQ %MAX_SIZE_MB% (
        echo [ARCHIVALAS] !FNAME! ^(!SIZE_MB! MB^)
        set "DEST=%ARCHIVE_DIR%\!FNAME!.%DATESTR%.gz"
        :: Windows-on powershell tömörítés
        powershell -Command "Compress-Archive -Path '!FPATH!' -DestinationPath '%ARCHIVE_DIR%\!FNAME!.%DATESTR%.zip' -Force" 2>nul
        if !ERRORLEVEL! EQU 0 (
            :: Sikeres archív: üresítjük a fájlt (nem töröljük, hogy a program ne crasheljen)
            type nul > "!FPATH!"
            echo [OK] !FNAME! archiválva és nullázva
        ) else (
            echo [HIBA] !FNAME! archiválása sikertelen
        )
    ) else (
        echo [SKIP] !FNAME! (!SIZE_MB! MB, limit: %MAX_SIZE_MB% MB^)
    )
)

:: Régi archívumok törlése (30 napnál régebbi)
echo.
echo Régi archívumok törlése ^(%KEEP_DAYS% napnál régebbiek^)...
forfiles /p "%ARCHIVE_DIR%" /m "*.zip" /d -%KEEP_DAYS% /c "cmd /c echo [TORLES] @file && del @path" 2>nul
if %ERRORLEVEL% EQU 1 echo [INFO] Nincs törölni való archív.

echo.
echo [KÉSZ] Log rotáció befejezve: %DATESTR%
endlocal
