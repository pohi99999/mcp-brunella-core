# Specifikáció: Learning Loop — Nightly Trainer

**Track ID:** `learning_loop_nightly_trainer_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `learning_loop_curated_golden_dataset_20260329`

## 1. Cél

A tanítóadatból automatizált, kontrollált és mérhető éjszakai training futás készüljön, amely nem zavarja a nappali operációt.

## 2. Scope

### Benne van
- Nightly training job orchestration
- Dataset snapshot készítés és artifact kezelés
- Train run metadata és failure reporting
- Erőforrás- és időablak alapú scheduling

### Nincs benne
- Teljes online/continual learning loop valós időben
- Automatic prod rollout
- Cross-tenant tréning

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `myai/training/nightly_trainer.py`
- Érintett vagy várható fő fájl/modul: `myai/training/dataset_curator.py`
- Érintett vagy várható fő fájl/modul: `src/server/schedulers/scheduledTasksRunner.ts`
- Érintett vagy várható fő fájl/modul: `src/core/goldenDatasetBridge.ts`
- Érintett vagy várható fő fájl/modul: `src/core/checkpoint.ts`

## 4. Fő deliverable-ek

- myai/training/nightly_trainer.py vagy ekvivalens pipeline
- Dataset snapshot és artifact output struktúra
- Scheduled runner integráció
- Train run log és eredmény-összefoglaló

## 5. Sikerkritériumok

- A nightly trainer csak curated snapshotból dolgozik
- Sikertelen training futás nem ír felül meglévő modelleket
- Artifact, config és run metadata verziózottan elmenthető
- A trainer futás beépül a scheduled task és observability rétegbe

## 6. Guardrail-ek és kockázatok

- Túl nagy resource igény blokkolhat más rendszereket
- Hibás snapshot esetén rossz modell készülhet
- Rollback nélkül veszélyes a továbblépés a registry felé
