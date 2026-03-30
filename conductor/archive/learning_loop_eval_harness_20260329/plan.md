# Végrehajtási Terv: Learning Loop — Eval Harness

**Track ID:** `learning_loop_eval_harness_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Eval runner / benchmark harness
- Routine task benchmark suite
- Regression gate szabályok
- Score report és összehasonlító output

## Todo lista

### 1. Benchmark tervezés

- [x] Reflex-task benchmark kategóriák kijelölése
- [x] Score metrikák és gate szabályok rögzítése
- [x] Baseline model meghatározása
### 2. Implementáció

- [x] Eval harness script vagy service létrehozása
- [x] Benchmark scenario csomag létrehozása
- [x] Összehasonlító report generator megírása
### 3. Integráció

- [x] Nightly trainer output fogadása és futtatása a harnessben
- [x] Model registry számára consumption-ready score output biztosítása
### 4. Validáció

- [x] Baseline vs candidate összehasonlító teszt
- [x] Regression gate trigger teszt
- [x] Report formátum és tárolás ellenőrzése

## Megjegyzések

- Elsődleges függőségek: `learning_loop_curated_golden_dataset_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
