# Specifikáció: PAIOS Orchestrator Chat Réteg
**Track ID:** `paios_orchestrator_chat_20260223`
**Státusz:** proposed
**Prioritás:** HIGH
**Forrás:** `docs/Claude-nak/PAIOS 1.0 – Péter AI Operating System.md`

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Fájl |
|---|---|---|
| ModelRouter (GPT-4o/Gemini/Local/CF) | ✅ KÉSZ | `src/core/modelRouter.ts` |
| AgentManager (execute, registry) | ✅ KÉSZ | `src/agents/AgentManager.ts` |
| OrchestratorAgent / EnterpriseOrchestratorAgent | ✅ KÉSZ | `src/agents/OrchestratorAgent.ts` |
| Phoenix Protocol (checkpoint, retry, eventbus) | ✅ KÉSZ | `src/core/checkpoint.ts` + társai |
| Task Queue (SQLite + D1) | ✅ KÉSZ | `src/agents/AgentManager.ts` |
| **PAIOS Orchestrator Chat endpoint** | ❌ HIÁNYZIK | `src/server/routes/paiosOrchestrator.ts` |
| **PAIOS rendszerprompt (magyar)** | ❌ HIÁNYZIK | `src/orchestrator/systemPrompt/` |
| **OrchestratorCore (task decomposition)** | ❌ HIÁNYZIK | `src/orchestrator/orchestratorCore.ts` |

**Ez a track az összekötő réteget implementálja.** A meglévő komponensek 90%-a már ott van.

---

## 2. Megoldás Architektúra

```
Péter (magyar chat, Dashboard)
    │
    ▼
POST /api/paios/chat
  { message: string, model?: "gpt4o" | "gemini" | "local" | "workers" }
    │
    ▼
orchestratorCore.ts
    ├── ModelRouter.ts → kiválasztott LLM (PAIOS rendszerprompttal)
    ├── LLM válasz: { plan: [...], tasks: [...], summary: string }
    ├── AgentManager.executeAgent() minden task-hoz
    └── Socket.IO emit: paios:task_created, paios:completed
    │
    ▼
Response: { summary: string, taskIds: string[], plan: PlanStep[] }
```

---

## 3. PAIOS Rendszerprompt (magyar)

`src/orchestrator/systemPrompt/paios_orchestrator_prompt.md`:

```
Te vagy a PAIOS Orchestrator – Péter AI Operating System központi irányítója.

Feladatod:
- Magyar nyelvű utasításokat kapsz Pétertől.
- A feladatokat fázisokra bontod (design, implementáció, teszt, deploy, kutatás).
- Minden fázishoz kiválasztod a megfelelő ügynököket az Agent Registry alapján.
- A végrehajtást a Worker Agents felé delegálod.
- A Task Store-ban rögzíted: feladat, státusz, log, eredmények.
- A Dashboard számára mindig készítesz egy érthető, magyar nyelvű összefoglalót.

Elérhető ügynökök: DeveloperAgent, ResearcherAgent, EvaluatorAgent,
SpecWriterAgent, RobotkezV2Agent, DataScientistAgent, LogisticsDispatcherAgent,
FinanceGuardian, SalesAgent, MarketingAgent, ProjectConductorAgent.

Szabályok:
- Mindig fázisokban gondolkodj.
- Ha a cél nem egyértelmű, kérdezz vissza RÖVIDEN (1 mondatban).
- Ha egy ügynök hibázik, Phoenix Protocol: fallback ügynök választása.
- A lehető legkevesebb lépésből, de robusztusan dolgozz.

Kimenet (KÖTELEZŐ JSON formátum):
{
  "plan": [{ "phase": string, "agent": string, "task": string }],
  "tasks": [{ "agent": string, "task": string, "priority": "high"|"medium"|"low" }],
  "summary": "Magyar nyelvű összefoglaló Péternek"
}
```

---

## 4. API Kontraktus

### Request
```typescript
POST /api/paios/chat
Content-Type: application/json

{
  "message": "Készíts egy új API-t TDD-vel a logisztikai modulhoz.",
  "model": "gemini"  // opcionális, default: env PAIOS_DEFAULT_MODEL vagy "local"
}
```

### Response
```typescript
{
  "success": true,
  "summary": "Elkezdtem a logisztikai API tervezését...",
  "plan": [
    { "phase": "Design", "agent": "SpecWriterAgent", "task": "Logisztikai API spec" },
    { "phase": "Implementáció", "agent": "DeveloperAgent", "task": "TDD alapú API kód" }
  ],
  "taskIds": ["task_abc123", "task_def456"]
}
```

---

## 5. OrchestratorCore Logika

```typescript
// src/orchestrator/orchestratorCore.ts
export async function processChat(message: string, model?: string): Promise<OrchestratorResult> {
  // 1. ModelRouter → LLM hívás PAIOS rendszerprompttal
  const llmResponse = await routeTask(message, { provider: model ?? defaultModel });

  // 2. JSON parse (try/catch, fallback: raw text → summary mezőbe)
  const plan = parseOrchestratorPlan(llmResponse);

  // 3. AgentManager: minden task → queue-ba + execute
  const taskIds = await delegateTasks(plan.tasks);

  return { summary: plan.summary, plan: plan.plan, taskIds };
}
```

---

## 6. Függőségek

- `src/core/modelRouter.ts` — már kész, az orchestrator ezt hívja
- `src/agents/AgentManager.ts` — már kész, a task delegálás ide megy
- `src/server/SocketService.ts` — Socket.IO emit az eseményekhez
- `.env`: `PAIOS_DEFAULT_MODEL=local` (új env var, opcionális)
- **Blokkolja:** `paios_model_selector_ui_20260223` (a UI ezt hívja)
