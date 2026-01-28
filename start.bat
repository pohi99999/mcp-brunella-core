@echo off
setlocal
echo [Brunella Core] Rendszerinditas...

:: 1. Ollama ellenorzes es inditas
echo [1/4] Ollama ellenorzese...
tasklist /FI "IMAGENAME eq ollama app.exe" 2>NUL | find /I /N "ollama app.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    -> Ollama mar fut.
) else (
    echo    -> Ollama inditasa...
    start "" "C:\Users\pohi9\AppData\Local\Programs\Ollama\ollama app.exe"
    timeout /t 5 >nul
)

:: 2. Dokumentacio es Build (gyors)
echo [2/4] Karbantartas es Build...
if exist "scripts\generate_tree.mjs" call node scripts/generate_tree.mjs >nul 2>&1
if exist "scripts\generate_tools_inventory.mjs" call node scripts/generate_tools_inventory.mjs >nul 2>&1

:: Opcionalis: UI Build ha meg nincs (itt most csak logolunk, hogy ne lassitsuk)
if not exist "build\public\index.html" (
    echo    [!] UI build hianyzik. Kerlek futtasd: npm run build:ui
)

:: 3. MCP Szerver inditasa (KULON ABLAKBAN/Hatterben)
echo [3/4] MCP Brunella Core inditasa...
start "MCP Brunella Server" /MIN cmd /c "npm start"
timeout /t 5 >nul

:: 4. Kliensek inditasa
echo [4/4] Kliensek inditasa...

:: AnythingLLM
if exist "C:\Program Files\AnythingLLM\AnythingLLM.exe" (
    echo    -> AnythingLLM inditasa...
    start "" "C:\Program Files\AnythingLLM\AnythingLLM.exe"
) else (
    echo    [!] AnythingLLM nem talalhato a megadott helyen.
)

:: Sajat Dashboard megnyitasa
echo    -> Brunella Dashboard megnyitasa...
start http://localhost:3000

echo.
echo [KESZ] Minden rendszer aktiv.
echo A szerver a hatternaploban fut.
pause