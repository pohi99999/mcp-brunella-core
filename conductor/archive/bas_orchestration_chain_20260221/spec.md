# Specifikáció: BAS Orchestration Chain v1
**Track ID:** `bas_orchestration_chain_20260221`
**Státusz:** active ✅
**Prioritás:** HIGH
**Leválasztva:** `bas_core_architecture_v3_20260220` (Phase 2 + Phase 4)

---

## 1. Probléma és Motiváció

Az `OrchestratorAgent` jelenlegi implementációja az agent-hívásokat **egymástól függetlenül** végzi. Ha egy feladat több lépést igényel (pl. „Kutass utána → Elemezd → Írj kódot"), mindhárom agent egyszerre indul, és az eredmények nem csatornázódnak össze.

**Következmény:** Elveszett kontextus lépések között, duplikált LLM-hívások, nem determinisztikus output.

---

## 2. Megoldás: Step Pipeline

Az `OrchestratorAgent` a jövőben **szekvenciális láncban** hajtja végre a részfeladatokat:

```
Felhasználói szándék
        ↓
  TaskDecomposer (DAG)
        ↓
  Step 1: ResearcherAgent → output_1
        ↓
  Step 2: DeveloperAgent(input=output_1) → output_2
        ↓
  Step 3: EvaluatorAgent(input=output_2) → végeredmény
```

Minden lépés `ChainContext`-en keresztül kapja meg az előző lépés kimenetét.

---

## 3. Új Típusok (src/agents/types.ts)

```typescript
export interface ChainStep {
  agentName: string;
  task: string;
  dependsOn?: number;   // lépés index (topológiai sorrend)
}

export interface ChainContext {
  steps: ChainStep[];
  currentStep: number;
  accumulated: AgentResponse[];   // minden eddigi lépés eredménye
  metadata: Record<string, unknown>;
}
```

---

## 4. TaskDecomposer DAG → Valós Futás

A `TaskDecomposerAgent` jelenleg **preview módban** ad vissza DAG-ot. Az `autoStart: false` registry-beállítást **aktívvá** kell tenni, és az Orchestrator-nak el kell fogyasztania a DAG-ot.

Topológiai rendezés: **Kahn-algoritmus** — a csomópontokat `dependsOn` lista alapján rendezi sorba, garantálva a determinisztikus végrehajtási sorrendet.

---

## 5. Dashboard: SystemArchitectureWidget

4 panel, valós adatokkal (nem mock):

| Panel | Forrás | Metrika |
|---|---|---|
| Ingestion | LanceDB row count | Begyűjtött vektorok száma |
| Knowledge | SQLite task_queue | Feldolgozásra váró / kész task-ok |
| Orchestration | AgentManager runtime | Aktív / idle agent-ek |
| Security | E2B / EvaluatorAgent | Sandbox futások, guardrail flagek |

Backend: `GET /api/system/architecture-status` összegyűjti a 4 panel adatait egy hívásban.

---

## 6. CLI Bővítés

```bash
brunella system arch          # 4 réteg táblázatos státusza
brunella system arch --json   # JSON output (CI/monitoring-hoz)
```

---

## 7. Függőségek

- `bas_security_sandbox_20260221` — a Security panel adatait az E2B sandbox manager adja
- `src/agents/TaskDecomposerAgent.ts` — már létezik, csak preview=false szükséges
- `src/core/modelRouter.ts` — a chaining lépések brain/muscle routingot használnak

---

## 8. Nem változik

- `src/core/goldenDatasetBridge.ts` — érintetlen (már kész)
- `src/utils/rag.ts` — LanceDB integráció érintetlen
- `src/utils/d1Adapter.ts` — D1 bridge érintetlen
