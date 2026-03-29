# Specifikáció: Ephemeral Agents — Runtime Spawn

**Track ID:** `ephemeral_agents_runtime_spawn_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Státusz:** ARCHIVED  
**Prioritás:** HIGH  
**Függőségek:** `zero_prompt_policy_engine_20260329`

## 1. Cél

A BAS ismeretlen vagy új alfeladatra ideiglenes specialistát tudjon generálni, amelyet a task végén le is lehet zárni.

## 2. Scope

### Benne van

- EphemeralAgentSpec és spawn API
- Supervisor/orchestrator kontroll és parent-child kapcsolat
- Task-local memory scope
- Agent példány életciklus alapok

### Nincs benne

- Teljes tool sandbox policy
- TTL/budget enforcement részletei
- Federated remote spawn

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/ephemeralAgentManager.ts`
- Érintett vagy várható fő fájl/modul: `src/agents/AgentManager.ts`
- Érintett vagy várható fő fájl/modul: `src/agents/DynamicAgent.ts`
- Érintett vagy várható fő fájl/modul: `src/agents/AgentArchitect.ts`
- Érintett vagy várható fő fájl/modul: `src/core/dagEngine.ts`

## 4. Fő deliverable-ek

- src/core/ephemeralAgentManager.ts
- Ephemeral agent spec séma
- Spawn / terminate workflow
- Supervisor integration az Orchestrator felé

## 5. Sikerkritériumok

- A rendszer létre tud hozni ideiglenes specialistát futás közben
- Az ágens parent taskhoz kötötten követhető
- A task végén az ephemeral agent lezárható vagy felszabadítható
- A létrejövő példány auditált metaadatot hagy maga után

## 6. Guardrail-ek és kockázatok

- Kontroll nélküli spawn runaway agent stormhoz vezethet
- Task-local memória perzisztencia hibákhoz vezethet
- A supervisor nélküli ágensek elszabadulhatnak
