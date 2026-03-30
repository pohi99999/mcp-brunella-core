# Specifikáció: Learning Loop — Eval Harness

**Track ID:** `learning_loop_eval_harness_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `learning_loop_curated_golden_dataset_20260329`

## 1. Cél

Training nélkül nincs értelme, ha nem tudjuk mérni, hogy jobb lett-e a reflex modell, ezért külön eval harness kell golden feladatcsomagokkal és gate-ekkel.

## 2. Scope

### Benne van
- Eval dataset és benchmark scenario-k definiálása
- Model-vs-model összehasonlító futtatás
- Score-ok, regressziók és gate-ek tárolása
- Promotion ajánlás alap biztosítása a model registryhez

### Nincs benne
- Teljes observability termékpanel
- Emberi review UI minden benchmarkhoz
- Federated remote benchmark exchange

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `myai/training/eval_harness.py`
- Érintett vagy várható fő fájl/modul: `myai/training/eval_scenarios/`
- Érintett vagy várható fő fájl/modul: `src/core/modelRouter.ts`
- Érintett vagy várható fő fájl/modul: `src/core/goldenDatasetBridge.ts`
- Érintett vagy várható fő fájl/modul: `test/evals/`

## 4. Fő deliverable-ek

- Eval runner / benchmark harness
- Routine task benchmark suite
- Regression gate szabályok
- Score report és összehasonlító output

## 5. Sikerkritériumok

- Új reflex modell csak mérhető benchmark eredménnyel léphet tovább
- A harness kimutatja a regressziókat a baseline-hoz képest
- A score report alkalmas registry promotion döntéshez
- Legalább egy nightly trainer outputtal összeköthető

## 6. Guardrail-ek és kockázatok

- Rosszul választott benchmark félrevezető lesz
- A túl kicsi eval készlet nem mutat valódi regressziót
- Szubjektív scoring automatikus promotiont torzíthat
