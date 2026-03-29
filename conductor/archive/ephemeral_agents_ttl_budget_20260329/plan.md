# Végrehajtási Terv: Ephemeral Agents — TTL és Budget

**Track ID:** `ephemeral_agents_ttl_budget_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Ephemeral lease manager
- Budget counter és policy hook
- Kill-switch / termination stratégia
- Budget exhaustion események

## Todo lista

### 1. Budget model

- [x] TTL, token, cost és step budget mezők definiálása
- [x] Escalation és termination policy rögzítése
### 2. Implementáció

- [x] Lease manager modul létrehozása
- [x] Budget counter és usage hookok bekötése
- [x] Graceful terminate és forced kill logika megírása
### 3. Integráció

- [x] ModelRouter és telemetry adatok felhasználása a budgethez
- [x] Supervisor decision flow kiegészítése budget eseményekkel
### 4. Validáció

- [x] TTL timeout teszt
- [x] Budget exhaustion teszt
- [x] Kill-switch és checkpoint restore smoke teszt

## Megjegyzések

- Elsődleges függőségek: `ephemeral_agents_runtime_spawn_20260329`, `ephemeral_agents_limited_tools_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
- Verifikáció: `npm run build` ✅, `npm run build:ui` ✅, célzott Ephemeral Vitest kör `33/33` ✅, teljes `npm test` ✅ (`223` passed files, `2211` passed tests, `1` skipped file).
