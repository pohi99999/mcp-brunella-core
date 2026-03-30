# Plan — Agent Health Matrix

## Status: COMPLETED | Priority: MEDIUM | Assignee: Copilot

## Leírás

57 agent van regisztrálva, de nincs teszt ami ellenőrzi hogy mindegyik példányosítható és futtatható. Mátrix teszt + összesítő riport.

## Phase 1 — Health check script ✅

- [x] `scripts/agent_health_check.ts` — Önálló CLI script
- [x] Összesítő riport: ✅ OK / ❌ FAIL / ⚠️ SKIP (opcionális függőség)
- [x] JSON kimenet Dashboard-hoz

## Phase 2 — Vitest integráció ✅

- [x] `test/agent_health_matrix.test.ts` — Registry-alapú dinamikus tesztek (164/164 PASS)
- [x] Minden agent modul létezik, importálható és példányosítható

## Definition of Done

- [x] Minden agent példányosítható (`new Agent()` nem dob hibát)
- [x] Összesítő riport generálható
- [x] Törött agent-ek azonosítva és dokumentálva — jelen validációban nincs nyitott törött agent

## Validation

- [x] `npm run agent:health -- --json`
- [x] `npx vitest run test/agent_health_matrix.test.ts`
- [x] `npm test`
