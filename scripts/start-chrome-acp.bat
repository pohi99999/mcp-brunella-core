@echo off
setlocal

echo [Chrome ACP] Ellenorzes indul...
where acp-proxy >nul 2>&1
if errorlevel 1 (
  echo [HIBA] Az acp-proxy nincs telepitve vagy nincs PATH-ban.
  echo Telepites: npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [HIBA] A node nincs telepitve vagy nincs PATH-ban.
  echo Telepites: npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp
  exit /b 1
)

for /f "delims=" %%i in ('npm prefix -g') do set "NPM_PREFIX=%%i"
set "ACP_ENTRY=%NPM_PREFIX%\node_modules\@zed-industries\claude-code-acp\dist\index.js"

if not exist "%ACP_ENTRY%" (
  echo [HIBA] A Chrome ACP adapter entrypoint nem talalhato:
  echo         %ACP_ENTRY%
  echo Telepites: npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp
  exit /b 1
)

echo [Chrome ACP] Proxy inditasa uj ablakban...
start "Chrome ACP Proxy" cmd /k "acp-proxy --no-auth node "%ACP_ENTRY%""

timeout /t 2 >nul
echo [Chrome ACP] Megnyitas: http://localhost:9315
start "" http://localhost:9315

exit /b 0
