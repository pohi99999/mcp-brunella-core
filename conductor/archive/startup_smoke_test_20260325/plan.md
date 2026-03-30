# Plan — Startup Smoke Test

## Status: COMPLETED | Priority: MEDIUM | Assignee: Copilot

## Leírás

Az inditas.bat 9 szolgáltatást indít — automatizált végpontellenőrzés ami minden port/endpointot tesztel.

## Phase 1 — Smoke test script ✅

- [x] `scripts/startup_smoke_test.ts` — Végpont ellenőrzés:

  - :3000/api/health (Express backend)
  - :8000/health (FastAPI)
  - :5173 (Dashboard UI)
  - :11434/api/tags (Ollama)
  - :3001 (AnythingLLM, opcionális)

- [x] Összesítő riport színes ASCII táblázatban
- [x] Exit code: 0 ha minden OK, 1 ha bármi hibás

## Phase 2 — inditas.bat integráció ✅

- [x] inditas.bat 9. lépése használja ezt a scriptet
- [x] `npm run smoke` parancs frissítése

## Definition of Done

- [x] `npx tsx scripts/startup_smoke_test.ts` futtatható külön
- [x] Minden elérhető szolgáltatás ✅, nem elérhető ❌ jelzéssel

## Validation

- [x] `npm run smoke`
- [x] `inditas.bat` step 9 integráció
