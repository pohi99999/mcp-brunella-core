@echo off
:: ============================================================
::  🔍 BRUNELLA Lead Intelligence Worker — Deploy + Teszt
::  Futtatás: scripts\deploy-lead-intelligence.bat
:: ============================================================

echo.
echo  🔍 BRUNELLA Lead Intelligence Worker
echo  =====================================
echo.

cd /d F:\mcp-brunella-core\cloudflare

echo  📋 LÉPÉS 1/4: D1 adatbázis létrehozása...
npx wrangler d1 create brunella-leads --config wrangler.lead-intelligence.jsonc
echo  ⚠️  Másold be a database_id-t a wrangler.lead-intelligence.jsonc fájlba!
echo.
pause

echo  📋 LÉPÉS 2/4: KV Namespace létrehozása...
npx wrangler kv:namespace create "BAS_TASKS" --config wrangler.lead-intelligence.jsonc
echo  ⚠️  Másold be a KV id-t a wrangler.lead-intelligence.jsonc fájlba!
echo.
pause

echo  📋 LÉPÉS 3/4: Worker deploy...
npx wrangler deploy --config wrangler.lead-intelligence.jsonc
echo.

echo  📋 LÉPÉS 4/4: Teszt kutatás futtatása (kozmetika / Budapest)...
echo.
echo  POST https://brunella-lead-intelligence.[ACCOUNT].workers.dev/research
echo  Body: {"industry": "kozmetika", "city": "Budapest", "limit": 10}
echo.

:: Lokális tesztelés (wrangler dev módban)
echo  Lokális teszt indítása: http://localhost:8788
start cmd /k "npx wrangler dev --config wrangler.lead-intelligence.jsonc"

timeout /t 3

:: Health check
curl -s http://localhost:8788/health
echo.
echo.

:: Teszt kutatás indítása
echo  Teszt kutatás indítása...
curl -s -X POST http://localhost:8788/research ^
  -H "Content-Type: application/json" ^
  -d "{\"industry\": \"kozmetika\", \"city\": \"Budapest\", \"limit\": 10}"
echo.
echo.

echo  ✅ KÉSZ! Ellenőrizd a worker terminálját az eredményekért.
echo  📊 Leadek megtekintése: http://localhost:8788/leads?industry=kozmetika
echo.
pause
