# Specifikáció: Zero-Prompt Core — GitHub + Health + Scheduled Inputok

**Track ID:** `zero_prompt_signal_ingest_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `zero_prompt_event_fabric_20260329`

## 1. Cél

A Zero-Prompt működés első valódi inputjai legyenek élők: GitHub issue/workflow failure, health anomália és schedule-ből származó háttérjelzések.

## 2. Scope

### Benne van
- GitHub workflow failure és issue/pr jellegű események normalizálása
- System health anomália események előállítása
- Scheduled task outcome események előállítása
- Prioritás és payload enrichment ezeknél a forrásoknál

### Nincs benne
- Email inbox és calendar figyelés
- Külső SaaS vendor jelek vagy remote MCP partner inputok
- Jóváhagyási csatornák megvalósítása

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/server/routes/webhooks.ts`
- Érintett vagy várható fő fájl/modul: `src/utils/systemHealth.ts`
- Érintett vagy várható fő fájl/modul: `src/server/schedulers/scheduledTasksRunner.ts`
- Érintett vagy várható fő fájl/modul: `src/tools/deploymentAnalyzer.ts`
- Érintett vagy várható fő fájl/modul: `src/core/eventFabric.ts`

## 4. Fő deliverable-ek

- GitHub source adapter(ek)
- Health monitor source adapter
- Scheduled tasks outcome adapter
- Alap esemény-prioritási mapping táblák

## 5. Sikerkritériumok

- GitHub workflow failure esemény automatikusan EventEnvelope-ként bekerül
- Health degradáció önálló rendszeres pollból eseményt hoz létre
- Scheduled task success/failure eseményként látszik az Event Fabricben
- A három forrásból jövő események policy-ra küldhetők

## 6. Guardrail-ek és kockázatok

- GitHub payload verifikáció nélkül hamis esemény jöhet be
- Health poll spam túl sok zajt termelhet
- Scheduled task runner és event source könnyen kétszer logolhat
