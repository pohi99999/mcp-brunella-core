# Végrehajtási Terv: Learning Loop — Reflex Model Registry

**Track ID:** `learning_loop_reflex_model_registry_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/reflexModelRegistry.ts
- Registry storage séma
- ModelRouter reflex branch
- Promotion és rollback folyamatok

## Todo lista

### 1. Registry design

- [x] Model version és lifecycle mezők definiálása
- [x] Promotion, shadow és rollback szabályok rögzítése
### 2. Implementáció

- [x] Reflex model registry modul létrehozása
- [x] Artifact metadata ingest kialakítása
- [x] ModelRouter reflex szint branch implementálása
- [x] Rollback és safe default logic bevezetése
### 3. Integráció

- [x] Nightly trainer és eval harness output bekötése
- [x] Observability/stat endpointok biztosítása a registryhez
### 4. Validáció

- [x] Candidate → active promotion teszt
- [x] Rollback teszt
- [x] Rutin task routing smoke teszt

## Megjegyzések

- Elsődleges függőségek: `learning_loop_nightly_trainer_20260329`, `learning_loop_eval_harness_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
