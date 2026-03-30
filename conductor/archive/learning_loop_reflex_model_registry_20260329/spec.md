# Specifikáció: Learning Loop — Reflex Model Registry

**Track ID:** `learning_loop_reflex_model_registry_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `learning_loop_nightly_trainer_20260329`, `learning_loop_eval_harness_20260329`

## 1. Cél

A tréning és eval eredmények csak akkor hasznosak, ha kontrolláltan nyilvántartjuk a candidate, shadow és active reflex modelleket.

## 2. Scope

### Benne van
- Model version metadata és lifecycle
- Candidate / shadow / active állapotok
- ModelRouter integráció reflex szinthez
- Rollback és promotion szabályok

### Nincs benne
- Distributed multi-node model sync
- Federated partner model csere
- Teljes MLOps platform

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/reflexModelRegistry.ts`
- Érintett vagy várható fő fájl/modul: `src/core/modelRouter.ts`
- Érintett vagy várható fő fájl/modul: `src/core/bifrost_gateway.ts`
- Érintett vagy várható fő fájl/modul: `myai/training/nightly_trainer.py`
- Érintett vagy várható fő fájl/modul: `myai/training/eval_harness.py`

## 4. Fő deliverable-ek

- src/core/reflexModelRegistry.ts
- Registry storage séma
- ModelRouter reflex branch
- Promotion és rollback folyamatok

## 5. Sikerkritériumok

- A registry tárolja a trainer és eval output metaadatait
- Csak jóváhagyott/passing candidate lehet active
- Rollback egy lépésben végrehajtható
- A ModelRouter tud reflex modellt választani rutin taskokra

## 6. Guardrail-ek és kockázatok

- Registry nélkül a rossz modell véletlenül aktívvá válhat
- Routing bug esetén a reflex modell rossz feladatot kap
- Artifact metadata hiány esetén nehéz debuggolni
