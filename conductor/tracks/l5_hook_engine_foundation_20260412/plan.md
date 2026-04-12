# Implementation Plan: Hook Engine Foundation

## 📋 Fázisok

### 1. Fázis: Infrastruktúra és Alapok
- [ ] Task: Unit tesztek létrehozása az `AgentHookEngine` alapfunkcióihoz (`test/agentHookEngine.test.ts`).
- [ ] Task: `AgentHookEngine` osztály implementálása (`src/core/agentHookEngine.ts`).
    - Hook regisztráció (in-memory lista).
    - Hook fire mechanizmus (async).
- [ ] Task: Conductor - User Manual Verification '1. Fázis: Infrastruktúra és Alapok' (Protocol in workflow.md)

### 2. Fázis: Perzisztencia és Hibatűrés
- [ ] Task: Hook audit integráció az `EventStore`-al.
- [ ] Task: Dead Letter Queue (DLQ) implementálása a sikertelen hook hívásokhoz.
- [ ] Task: Circuit Breaker alapok (egyszerű hiba-számláló).
- [ ] Task: Conductor - User Manual Verification '2. Fázis: Perzisztencia és Hibatűrés' (Protocol in workflow.md)

### 3. Fázis: Éles Hookok Integrációja
- [ ] Task: `invoice:received` hook bekötése a számla pipeline-ba.
- [ ] Task: `agent:task:failed` hook bekötése a Phoenix Protocol-ba.
- [ ] Task: Regressziós tesztek futtatása a teljes rendszeren.
- [ ] Task: Conductor - User Manual Verification '3. Fázis: Éles Hookok Integrációja' (Protocol in workflow.md)

## 🏁 Elfogadási Feltételek (DoD)
- Az összes unit teszt sikeres.
- A hook hívások nyomon követhetők az adatbázisban.
- Legalább egy éles folyamat (pl. számla pipeline) hook-alapú indítása igazolt.
