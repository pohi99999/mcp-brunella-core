# Megvalósítási Terv: System Recovery

## Fázis 1: Környezet Helyreállítása
- [ ] **Task 1.1: .env Pótlása**
    - Létrehozni a `.env` fájlt biztonságos alapértelmezett értékekkel (vagy a `.env.example` alapján).

## Fázis 2: Importok és Modulok Javítása (A Build Fix)
- [ ] **Task 2.1: Hiányzó Kiterjesztések Pótlása (`cli.ts`, `utils`)**
    - Végigmenni a `src/cli.ts` és `src/utils/*.ts` fájlokon.
    - Minden relatív import végére odatenni a `.js`-t (pl. `import ... from './utils/mcpClient'` -> `'./utils/mcpClient.js'`).
- [ ] **Task 2.2: Eltűnt Modulok Helyreállítása (`web.ts` Refaktor)**
    - Elemezni a `src/server/web.ts`-t.
    - Átirányítani a `../cli/mcp_client.js` -> `../utils/mcpClient.js` (és társait).
    - **Döntési Pont:** A `ToolManager` és `McpProcessManager` hivatkozásokat kiváltani a `registry.ts` használatával, vagy ideiglenesen kikommentelni/stub-olni a funkcionalitást, ha az architektúra megváltozott.

## Fázis 3: Típus és Export Hibák Javítása
- [ ] **Task 3.1: AgentManager Exportok**
    - Javítani a `src/agents/types.ts` (vagy ahol definiálva vannak) exportjait, hogy az `AgentManager.ts` lássa az `ExecutionPlan`-t.
- [ ] **Task 3.2: Implicit Any Javítások**
    - Javítani a `cli.ts` és `server/web.ts` fájlokban lévő típusdefiníciós hiányosságokat (paraméterek típusozása).

## Fázis 4: Verifikáció
- [ ] **Task 4.1: Build Teszt**
    - Futtatni: `npm run build`. Addig ismételni a javításokat, amíg zöld nem lesz.
- [ ] **Task 4.2: Szerver Indítás**
    - Futtatni: `npm start`. Ellenőrizni, hogy elindul-e és nem omlik össze azonnal.
