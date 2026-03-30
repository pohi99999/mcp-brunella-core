# Végrehajtási Terv: Learning Loop — Nightly Trainer

**Track ID:** `learning_loop_nightly_trainer_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- myai/training/nightly_trainer.py vagy ekvivalens pipeline
- Dataset snapshot és artifact output struktúra
- Scheduled runner integráció
- Train run log és eredmény-összefoglaló

## Todo lista

### 1. Training flow design

- [x] Dataset snapshot és artifact naming konvenció rögzítése
- [x] Nightly időablak, resource cap és rollback policy meghatározása
### 2. Implementáció

- [x] Nightly trainer script / service létrehozása
- [x] Scheduled task integráció bekötése
- [x] Run metadata és artifact output mentése
- [x] Checkpoint és failure handling hozzáadása
### 3. Integráció

- [x] Curated dataset export bekötése a trainer elé
- [x] Eredmény summary kapcsolása dashboard/CLI felé
### 4. Validáció

- [x] Dry-run tréning futtatás
- [x] Artifact létrejöttének ellenőrzése
- [x] Failure rollback szimuláció

## Megjegyzések

- Elsődleges függőségek: `learning_loop_curated_golden_dataset_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
