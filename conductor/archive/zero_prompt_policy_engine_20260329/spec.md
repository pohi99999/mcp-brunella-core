# Specifikáció: Zero-Prompt Core — Policy Engine

**Track ID:** `zero_prompt_policy_engine_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `zero_prompt_event_fabric_20260329`

## 1. Cél

A BAS autonómiája csak akkor lehet biztonságos, ha minden eseményt és javasolt akciót konzisztens policy-rétegen keresztül minősítünk.

## 2. Scope

### Benne van
- Risk score, action class és autonomy level modell
- Szabályalapú policy kiértékelés esemény + kontextus alapján
- Safe / guarded / dangerous döntési kategóriák
- Approval-kötelezettség és hard-stop guardrail logika

### Nincs benne
- Slack/Discord/email csatorna-kliens implementáció
- Ephemeral agent spawn végrehajtás
- Külső partner trust registry

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/policyEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/core/reflectionEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/core/copilotCognitiveBridge.ts`
- Érintett vagy várható fő fájl/modul: `src/agents/permissions.ts`
- Érintett vagy várható fő fájl/modul: `src/security/redactor.ts`

## 4. Fő deliverable-ek

- src/core/policyEngine.ts
- Risk / autonomy scoring contract
- Guardrail szabálykészlet kritikus műveletekre
- Policy audit log rekordok

## 5. Sikerkritériumok

- Minden normalizált esemény policy-kiértékelést kap
- Magas kockázatú esemény nem tud approval nélkül végrehajtást indítani
- A policy döntés visszakövethető audit logban
- A decision outcome használható az Approval Router inputjaként

## 6. Guardrail-ek és kockázatok

- Túl agresszív policy béníthatja az autonómiát
- Túl laza policy valódi károkat okozhat
- A szabályok szétcsúszhatnak, ha nincs központi ownership
