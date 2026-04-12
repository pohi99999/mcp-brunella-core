# Plan — Node↔Python Bridge E2E Tesztek

> Governance note (2026-04-12): this track is archived as delivered after the live bridge harness was repaired and the FastAPI contract drift was backfilled into the Node schema/tests.

## Fázisok

### FÁZIS 1 — Infrastruktúra
- [ ] FastAPI test-szerver indítás helper (`test/helpers/startPythonServer.ts`)
- [ ] Vitest beforeAll/afterAll: szerver start/stop (subprocess)
- [ ] `test/integration/` könyvtár + Vitest config bővítés

### FÁZIS 2 — Sikerút tesztek
- [ ] `/health` — Python subsystem health check válasz validáció
- [ ] `/rag/query` — query küldés + válasz Zod validáció
- [ ] `/comet/execute` — scenario futtatás + result shape validáció
- [ ] `/comet/memory` — memory clear + 30 napos default

### FÁZIS 3 — Hibakép tesztek
- [ ] FastAPI nem elérhető → `pythonBridge.ts` graceful degradation, nem crash
- [ ] Schema mismatch → `logWarn()` hívódik (`pythonBridge.ts` Zod parse fail ág)
- [ ] Timeout kezelés

### FÁZIS 4 — CI integráció
- [ ] `package.json` → `"test:integration"` script
- [ ] README/AGENTS.md megjegyzés: mikor futtatandó

## Érintett fájlok (várható)

- `test/integration/pythonBridge.integration.test.ts` (új)
- `test/helpers/startPythonServer.ts` (új)
- `src/utils/pythonBridge.ts` (esetleg schema bővítés)
- `vitest.config.ts` (include path bővítés)
- `package.json` (script bővítés)

## Megjegyzések

- A Python szerver indítása `uv run uvicorn server:app --port 8099 --app-dir myai` legyen
  (nem a default 8000, hogy ne ütközzön dev szerverrel teszteléskor)
- Csak akkor futtatandó ha `PYTHON_BRIDGE_E2E=1` env van set — ne lassítsa a fast suite-ot
