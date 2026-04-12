# Végrehajtási Terv: Ephemeral Agents — Cleanup és Audit

**Track ID:** `ephemeral_agents_cleanup_audit_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Ephemeral audit schema
- Artifact cleanup / retention szabályok
- Termination summary generator
- Postmortem nézethez szükséges metaadatok

## Todo lista

### 1. Retention policy

- [x] Artifact retention és purge szabályok rögzítése
- [x] Audit record mezők és kötelező field-ek meghatározása
### 2. Implementáció

- [x] Cleanup executor megírása
- [x] Audit trail mentés hozzáadása a terminate flowhoz
- [x] Termination summary generator létrehozása
### 3. Integráció

- [x] Dashboard vagy CLI betekintés biztosítása a postmortemhez
- [x] Phoenix recovery / checkpoint kapcsolódási pontok ellenőrzése
### 4. Validáció

- [x] Cleanup utáni state-ellenőrzés
- [x] Artifact retention teszt
- [x] Audit trail completeness teszt

## Megjegyzések

- Elsődleges függőségek: `ephemeral_agents_ttl_budget_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
- Verifikáció: `npm run build` ✅, `npm run build:ui` ✅, célzott Ephemeral Vitest kör `33/33` ✅, teljes `npm test` ✅ (`223` passed files, `2211` passed tests, `1` skipped file).
