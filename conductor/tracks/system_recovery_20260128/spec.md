# Track Specifikáció: Rendszer Helyreállítás (System Recovery)

## 1. Célkitűzés
A Brunella Core szerveroldali kódjának javítása olyan állapotra, hogy a TypeScript fordítás (`npm run build`) hiba nélkül lefusson, és a szerver elinduljon. Ez a track a `System Audit` során feltárt 37 build hiba és strukturális hiányosság javítására fókuszál.

## 2. Hatókör (Scope)

### A. Konfiguráció
- `.env` fájl pótlása a gyökérben (template alapján).

### B. Kód Refaktorálás & Javítás
- **Import Útvonalak:** A megszűnt `src/cli/` mappára mutató hivatkozások átirányítása a helyes `src/utils/` helyre.
- **Modul Feloldás:** Hiányzó `.js` kiterjesztések pótlása az importok végéről (`Node16` kompatibilitás).
- **Legacy Kód Migráció:** A `src/server/web.ts` fájlban lévő hivatkozások (pl. `ToolManager`, `McpProcessManager`) frissítése az új `registry.ts` alapú architektúrára vagy a hiányzó osztályok stub-olása.
- **Típusbiztonság:** Az `implicit any` hibák és hiányzó exportok (`AgentManager.ts`) javítása.

## 3. Elvárt Kimenet
1.  **Sikeres Build:** `npm run build` 0 exit code-dal.
2.  **Futó Szerver:** `npm start` hiba nélkül elindítja a szervert és az MCP végpontokat.
3.  **Tiszta Kód:** Nincsenek "halott" importok vagy nem létező fájlokra mutató hivatkozások.

## 4. Sikerességi Kritériumok
- A szerver válaszol a `ping` kérésre (ha az MCP endpoint él).
- A Dashboard továbbra is betöltődik.
