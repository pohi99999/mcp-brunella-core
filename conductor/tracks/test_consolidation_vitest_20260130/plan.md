# Plan: Test Infrastructure Consolidation (Vitest)

**Track ID:** `test_consolidation_vitest_20260130`
**Cél:** A jelenlegi heterogén tesztelési környezet (node --test, ts-node, vitest) egységesítése Vitest alatt.

## 1. Helyzetkép
Jelenleg a `package.json` scriptjei vegyesek:
- `test:run`: `node --test` (lefordított JS-en)
- `test:unit:cli`: `ts-node` loaderrel
- `test:vitest`: Már létezik, de nem fedi le a teljes rendszert.

## 2. Lépések

- [x] **1. Vitest Konfiguráció Ellenőrzése:** Megvizsgáljuk a `vitest.config.ts`-t és kiterjesztjük a teljes `test/` mappára.
- [x] **2. Teszt Fájlok Migrálása:**
    - A `test/core_tools.test.ts` átírása Vitest kompatibilisre (pl. `import { test, expect } from 'vitest'`).
    - A `test/monitor.test.ts` ellenőrzése.
    - CLI tesztek ellenőrzése.
- [x] **3. Package.json Scriptek Egyszerűsítése:**
    - `test` parancs legyen egyenlő `vitest run`.
    - Felesleges build lépések (`test:build`, `test:prepare`) törlése, ha a Vitest kezeli a TS-t.
- [x] **4. Verifikáció:** Minden teszt sikeres futtatása.

## 3. Siker Kritériumok
- Minden teszt zöld.
- Nincs szükség előzetes `tsc` fordításra a teszteléshez.
- `npm test` parancs egységesen futtat mindent.