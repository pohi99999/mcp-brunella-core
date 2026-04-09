# Developer dev loop (Implementation-Ready)

Összefoglaló
---------
Ez a dokumentum lépésről lépésre leír egy javasolt, megvalósításra kész fejlesztési ciklust a Brunella-kódbázisra (TypeScript Node core + Python myai + opcionális C# MCP). Cél: gyors visszajelzés, stabil build, megbízható helyi futtatás és reprodukálható tesztelés.

Előfeltételek
-------------
- Node.js 18+, npm
- Python 3.12 + `uv` (myai esetén)
- PowerShell (Windows) a csharp-mcp-serverhez
- Helyi repo: `F:\mcp-brunella-core`

Gyakori parancsok
-----------------
- Telepítés: `npm ci`
- Build: `npm run build`
- Gyors tesztek: `npm run test:fast`
- Fejlesztés (hot-reload): `npm run dev` (TypeScript ts-node/esm loader)
- UI dev: `npm run dev:ui`
- Smoke health: `npm run smoke`

1) Első indítás (setup)
------------------------
1. `npm ci`
2. (Ha szükséges) `cd myai && uv sync`
3. `npm run build` — ellenőrzi, hogy a TypeScript fordul
4. `npm run mcp:validate` — ellenőrzi az MCP konfigurációt

2) Lokális fejlesztési ciklus
----------------------------
1. Branch létrehozása: `git switch -c feat/xxx`
2. `npm run dev` — backend dev mód
3. `npm run dev:ui` — dashboard dev (külön terminál)
4. Fejlesztés: kódmódosítások → verziókövetés
5. Lokális unit tesztek írása: `npx vitest run test/<mytest>.test.ts`
6. Előtte: `npm run lint` és `npm run test:fast`
7. Commit és push

3) Full rendszer futtatása (használati forgatókönyv)
--------------------------------------------------
- Windows: `start-full.bat` (megj.: egyes szolgáltatások előmelegítése: csharp-mcp-server)
- Alternatíva (manuál):
  - `powershell .\\csharp-mcp-server\\launch.ps1 -WarmupOnly`
  - `npm run start:stable` (Node core)
  - `cd myai && uv run uvicorn server:app --port 8000`
  - `npm run dev:ui`

4) Hibakeresés & health checks
-----------------------------
- Konzol logok: `logs/` és `playwright-report/`
- `npm run smoke` — gyors egészségellenőrzés
- Ha `better-sqlite3` hibák: `npm rebuild better-sqlite3`

Szekvencia (egyszerű, ASCII)
---------------------------
Developer -> Git commit -> CI (build/test) -> MCP config sync -> Start services -> Smoke test

Teszt minták
------------
- Unit: Vitest (test/**). Gyors visszajelzés: `npm run test:fast`.
- Integration: `npm run test:e2e` (Playwright)
- Env érzékeny tesztek: használj `vi.stubEnv()` a tesztekben

Pull request checklist
----------------------
- [ ] `npm run lint` — nincs warning
- [ ] `npm run test:fast` — minden teszt zöld
- [ ] Dokumentáció frissítve (ha API vagy viselkedés változott)

Fájlok és helyek
-----------------
- `package.json` – parancsok, függőségek
- `conductor/tracks/*` – munkafolyamat/track kontextus
- `src/agents/registry.json` – agent definíciók

Jegyzet
------
További részletek és diagramok generálhatók (PlantUML/mermaid). Készítek hozzá sekvencia-diagramot és ellenőrzőlistát, ha kéred.
