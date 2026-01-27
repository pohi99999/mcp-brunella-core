# Spec: Brunella CLI – Gemini CLI szint

## Elfogadási kritériumok (teljesített)
- CLI parancsok paritása: Conductor (`conductor show/phase/task/run`), tools/list/call, config add/update/remove, doctor (--json), ideiglenes mcp:run/cli:run.
- Extension lifecycle: install/update/uninstall + reload, automatikus rediscover, betöltött bővítmények listázása.
- Bővítmények: `brunella-extension-conductor`, `brunella-extension-jules`, `brunella-extension-agents`, `brunella-extension-github`.
- MCP kliens robusztusság: timeoutos connect, healthCheck, reconnect, watchdog (`MCP_WATCHDOG_MS`).
- Dashboard Tools UX: schema-alapú modális űrlap (boolean switch, enum select, típus szerinti input), badge/szűrő és prioritás rendezés.
- AnythingLLM: `.env.local` példa; smoke sikeres (BASE_URL, WORKSPACE, API_KEY).
- Tesztek: `npm test`, `test:unit:cli`, `test:cli`, `test:e2e`, `smoke` zöld; `test_prepare.cjs` biztosítja a CJS típuskezelést a `test_build`-ben.

## Nem-funkcionális elvárások
- CLI parancsok hibatűrő logolással; install/uninstall során státusz kiírás.
- Watchdog alapértelmezett intervallum biztonságos (10s), env-vel paraméterezhető.
- Dashboard űrlap validáció (schema típusonként).

## Maradék feladat (opcionális)
- Extension lifecycle e2e automatizált teszt.
- Watchdog finomhangolás nagy tool-terhelésnél.
- Tools űrlap: default érték + payload preview, részletes hibaüzenetek.
