@echo off
setlocal EnableExtensions
REM Chrome DevTools MCP — Chrome inditasa tavoli debuggolassal
REM Hasznalat: scripts\start-chrome-debug.bat [URL]
REM A chrome-devtools-mcp szerver szuksegeli a CDP port elerheteseget

set "CDP_PORT=9222"
set "START_URL=%~1"
if not defined START_URL set "START_URL=http://localhost:3000"
set "CHROME_EXE="
set "CHROME_PROFILE_DIR=%TEMP%\chrome-mcp-profile"

echo [chrome-debug] Chrome inditasa CDP modon (port: %CDP_PORT%)...

call :resolve_chrome
if errorlevel 1 exit /b 1

if not exist "%CHROME_PROFILE_DIR%" (
  mkdir "%CHROME_PROFILE_DIR%" >nul 2>&1
)

echo [chrome-debug] Chrome: "%CHROME_EXE%"
echo [chrome-debug] URL: %START_URL%
echo [chrome-debug] CDP: http://127.0.0.1:%CDP_PORT%
echo.
echo Az MCP szerver csatlakozni tud a chrome-devtools-mcp-vel.
echo Allj le: Ctrl+C, majd zard be a Chrome ablakot.
echo.

start "" "%CHROME_EXE%" ^
  --remote-debugging-port=%CDP_PORT% ^
  --remote-debugging-address=127.0.0.1 ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-extensions ^
  --disable-background-timer-throttling ^
  --user-data-dir="%CHROME_PROFILE_DIR%" ^
  "%START_URL%"

if errorlevel 1 (
  echo [HIBA] Chrome inditasa sikertelen.
  exit /b 1
)

echo [chrome-debug] Chrome elinditva. CDP elerheto: http://127.0.0.1:%CDP_PORT%
exit /b 0

:resolve_chrome
if defined CHROME_EXE if exist "%CHROME_EXE%" exit /b 0

for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist "%%~P" (
    set "CHROME_EXE=%%~P"
    exit /b 0
  )
)

for /f "delims=" %%P in ('where chrome 2^>nul') do (
  if not defined CHROME_EXE if exist "%%~fP" (
    set "CHROME_EXE=%%~fP"
    exit /b 0
  )
)

for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /i "REG_SZ"') do (
  if not defined CHROME_EXE if exist "%%B" (
    set "CHROME_EXE=%%B"
    exit /b 0
  )
)

for /f "tokens=2,*" %%A in ('reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /ve 2^>nul ^| find /i "REG_SZ"') do (
  if not defined CHROME_EXE if exist "%%B" (
    set "CHROME_EXE=%%B"
    exit /b 0
  )
)

echo [HIBA] Chrome nem talalhato! Telepitsd a Google Chrome-ot, vagy add hozza a PATH-hoz.
exit /b 1
