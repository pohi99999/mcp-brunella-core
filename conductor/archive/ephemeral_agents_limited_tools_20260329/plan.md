# Végrehajtási Terv: Ephemeral Agents — Limited Tools

**Track ID:** `ephemeral_agents_limited_tools_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Scoped tool registry wrapper
- Ephemeral tool permission model
- File/network guardrail integráció
- Sandbox violation audit események

## Todo lista

### 1. Sandbox design

- [x] Tool scope, file scope és network scope contract megírása
- [x] Violation esemény és hibaüzenet modell rögzítése
### 2. Implementáció

- [x] Scoped registry wrapper létrehozása
- [x] Ephemeral tool permission injection implementálása
- [x] Network/file policy hookok bekötése
- [x] Tool composition ellenőrzés kiegészítése
### 3. Integráció

- [x] Spawn flow során scope assignment hozzáadása
- [x] Supervisor dashboard/telemetry adatpontok hozzáadása
### 4. Validáció

- [x] Tiltott tool hívás blokkolási teszt
- [x] Tiltott file/network scope teszt
- [x] Engedélyezett minimál tool készlet smoke teszt

## Megjegyzések

- Elsődleges függőségek: `ephemeral_agents_runtime_spawn_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
- Verifikáció: `npm run build` ✅, `npm run build:ui` ✅, célzott Ephemeral Vitest kör `33/33` ✅, teljes `npm test` ✅ (`223` passed files, `2211` passed tests, `1` skipped file).
