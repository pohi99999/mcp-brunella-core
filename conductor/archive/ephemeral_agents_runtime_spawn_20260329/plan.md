# Végrehajtási Terv: Ephemeral Agents — Runtime Spawn

**Track ID:** `ephemeral_agents_runtime_spawn_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/ephemeralAgentManager.ts
- Ephemeral agent spec séma
- Spawn / terminate workflow
- Supervisor integration az Orchestrator felé

## Todo lista

### 1. Spec és lifecycle

- [x] EphemeralAgentSpec és lifecycle állapotok definiálása
- [x] Parent-child supervisor contract megírása
### 2. Implementáció

- [x] Ephemeral Agent Manager létrehozása
- [x] Spawn flow DynamicAgent / AgentArchitect alapokra építve
- [x] Terminate és cleanup hívások implementálása
### 3. Integráció

- [x] Orchestrator és DAG engine hookok bekötése
- [x] Policy Engine feltételek ellenőrzése spawn előtt
### 4. Validáció

- [x] Egyszeri spawn/terminate smoke teszt
- [x] Többszörös párhuzamos spawn kontroll teszt
- [x] Supervisor nélküli spawn tiltásának tesztje

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_policy_engine_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
- Verifikáció: `npm run build` ✅, `npm run build:ui` ✅, célzott Ephemeral Vitest kör `33/33` ✅, teljes `npm test` ✅ (`223` passed files, `2211` passed tests, `1` skipped file).
