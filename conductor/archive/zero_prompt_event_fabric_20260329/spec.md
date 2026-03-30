# Specifikáció: Zero-Prompt Core — Event Fabric

**Track ID:** `zero_prompt_event_fabric_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** nincs

## 1. Cél

A BAS minden releváns triggerét egy közös EventEnvelope modellre kell hozni, hogy a további autonóm logika már ne forrásspecifikus webhookokra és cron ágakra épüljön.

## 2. Scope

### Benne van
- EventEnvelope séma és adapter interfész definiálása
- GitHub webhook, health és scheduled inputok normalizálása
- Idempotencia, deduplikáció és replay/history támogatás
- Phoenix Event Bus és Socket.IO integráció az egységes eseményfolyamhoz

### Nincs benne
- Autonóm döntési szabályok és risk policy implementáció
- Jóváhagyási csatornák végleges kezelése
- Federated remote partner routing

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/eventFabric.ts`
- Érintett vagy várható fő fájl/modul: `src/core/phoenixEventBus.ts`
- Érintett vagy várható fő fájl/modul: `src/server/routes/webhooks.ts`
- Érintett vagy várható fő fájl/modul: `src/server/schedulers/scheduledTasksRunner.ts`
- Érintett vagy várható fő fájl/modul: `src/utils/systemHealth.ts`

## 4. Fő deliverable-ek

- src/core/eventFabric.ts
- EventEnvelope TypeScript típusok és adapter contract
- Perzisztens event history / replay tárolás
- GitHub + health + scheduler event adapterek

## 5. Sikerkritériumok

- A három elsődleges inputforrás azonos EventEnvelope formára fordul
- Duplikált webhook vagy poll esemény nem indít kétszer ugyanazt a láncot
- Az események visszajátszhatók diagnosztikához vagy teszthez
- A dashboard legalább aggregált formában látja az új eseményeket

## 6. Guardrail-ek és kockázatok

- Webhook storm esetén túl sok ismételt esemény keletkezhet
- A különböző forrás payloadjai gyorsan driftelhetnek
- Perzisztencia nélkül nehéz debuggolni az autonóm futásokat
