# Specifikáció: Learning Loop — Curated Golden Dataset

**Track ID:** `learning_loop_curated_golden_dataset_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** nincs

## 1. Cél

Ne minden sikeres futás legyen tanítóadat, hanem csak a minőségi, approval-zott, PII-mentes és jól címkézett minták kerüljenek be a tanulási körbe.

## 2. Scope

### Benne van
- Candidate sample capture több forrásból
- PII redaction és provenance kötelezővé tétele
- Quality threshold, dedupe és approval label logika
- Review queue a promotion előtt

### Nincs benne
- Nightly training pipeline maga
- Model rollout a routerbe
- Federated dataset exchange

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/goldenDatasetBridge.ts`
- Érintett vagy várható fő fájl/modul: `src/core/reflectionEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/core/toolRunCapture.ts`
- Érintett vagy várható fő fájl/modul: `src/security/redactor.ts`
- Érintett vagy várható fő fájl/modul: `src/server/memoryRoutes.ts`

## 4. Fő deliverable-ek

- Curated sample schema
- Golden sample candidate → approved flow
- PII redaction és provenance pipeline
- Review queue / promotion szabályrendszer

## 5. Sikerkritériumok

- A golden dataset csak review-olt vagy policy szerint engedett mintákat tartalmaz
- Minden rekordnál megvan a provenance és quality score
- Duplikált vagy érzékeny rekord nem jut át a promotion lépésen
- A dataset export egyértelműen használható a trainer számára

## 6. Guardrail-ek és kockázatok

- PII szivárgás komoly biztonsági probléma
- Túl kevés szűrés zajos tanítóadatot eredményez
- Túl sok szűrés esetén alig lesz elég tanítóadat
