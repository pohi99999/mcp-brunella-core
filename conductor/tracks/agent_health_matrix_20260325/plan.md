# Plan — Agent Health Matrix

## Status: ACTIVE | Priority: MEDIUM | Assignee: Copilot

## Leírás
57 agent van regisztrálva, de nincs teszt ami ellenőrzi hogy mindegyik példányosítható és futtatható. Mátrix teszt + összesítő riport.

## Phase 1 — Health check script
- [ ] `scripts/agent_health_check.ts` — Önálló CLI script (TODO: Phase 2-ben)
- [ ] Összesítő riport: ✅ OK / ❌ FAIL / ⚠️ SKIP (opcionális függőség)
- [ ] JSON kimenet Dashboard-hoz

## Phase 2 — Vitest integráció ✅
- [x] `test/agent_health_matrix.test.ts` — Registry-alapú dinamikus tesztek (164/164 PASS)
- [x] Minden agent modul létezik, importálható és példányosítható

## Definition of Done
- [ ] Minden agent példányosítható (`new Agent()` nem dob hibát)
- [ ] Összesítő riport generálható
- [ ] Törött agent-ek azonosítva és dokumentálva
