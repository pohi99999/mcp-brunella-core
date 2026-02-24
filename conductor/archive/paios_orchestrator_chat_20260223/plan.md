# Implementációs Terv: PAIOS Orchestrator Chat Réteg
**Track ID:** `paios_orchestrator_chat_20260223`

> ⚠️ Előfeltétel ellenőrzés indulás előtt:
> - `src/core/modelRouter.ts` létezik ✅
> - `src/agents/AgentManager.ts` létezik ✅
> - `src/server/SocketService.ts` létezik ✅
> - **Ezeket NE írd újra! Csak bővítsd / hívd.**

---

## Phase 1: OrchestratorCore + rendszerprompt

* [ ] **Task 1.1** — `src/orchestrator/` mappa létrehozása (ha nincs)

* [ ] **Task 1.2** — `src/orchestrator/systemPrompt/paios_orchestrator_prompt.md` — magyar PAIOS rendszerprompt (lásd spec.md §3)

* [ ] **Task 1.3** — `src/orchestrator/orchestratorCore.ts`
  ```typescript
  import { routeTask } from '../core/modelRouter.js';
  import { getAgentManager } from '../agents/AgentManager.js';
  import fs from 'fs/promises';

  export interface OrchestratorPlan {
    plan: { phase: string; agent: string; task: string }[];
    tasks: { agent: string; task: string; priority: string }[];
    summary: string;
  }

  export async function processChat(
    message: string,
    model?: string
  ): Promise<{ summary: string; plan: OrchestratorPlan['plan']; taskIds: string[] }> {
    const systemPrompt = await fs.readFile(
      new URL('./systemPrompt/paios_orchestrator_prompt.md', import.meta.url),
      'utf-8'
    );
    // 1. LLM hívás
    const fullPrompt = `${systemPrompt}\n\nFelhasználó kérése: ${message}`;
    const llmText = await routeTask(fullPrompt, { complexity: 'high', provider: model });
    // 2. JSON parse
    const parsed = parsePlan(llmText);
    // 3. AgentManager delegálás
    const manager = getAgentManager();
    const taskIds: string[] = [];
    for (const t of parsed.tasks) {
      const id = await manager.queueTask(t.agent, t.task);
      taskIds.push(id);
    }
    return { summary: parsed.summary, plan: parsed.plan, taskIds };
  }

  function parsePlan(raw: string): OrchestratorPlan {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch { /* ignore */ }
    return { plan: [], tasks: [], summary: raw.slice(0, 500) };
  }
  ```

---

## Phase 2: Express Route

* [ ] **Task 2.1** — `src/server/routes/paiosOrchestrator.ts`
  ```typescript
  import { Router } from 'express';
  import { processChat } from '../../orchestrator/orchestratorCore.js';
  import { getSocketService } from '../SocketService.js';
  import { logInfo, logError } from '../../utils/logger.js';

  const router = Router();

  router.post('/chat', async (req, res) => {
    const { message, model } = req.body as { message: string; model?: string };
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    try {
      logInfo('PAIOSOrchestrator', `Chat: "${message.slice(0, 60)}..." [model: ${model ?? 'default'}]`);
      const result = await processChat(message, model);
      getSocketService()?.emit('paios:completed', result);
      return res.json({ success: true, ...result });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('PAIOSOrchestrator', error);
      return res.status(500).json({ success: false, error });
    }
  });

  export default router;
  ```

* [ ] **Task 2.2** — `src/server/web.ts` bővítése:
  ```typescript
  import paiosOrchestratorRouter from './routes/paiosOrchestrator.js';
  // ...
  app.use('/api/paios', paiosOrchestratorRouter);
  ```

---

## Phase 3: Socket.IO real-time visszajelzés

* [ ] **Task 3.1** — `orchestratorCore.ts` bővítése: agent-enkénti emit
  ```typescript
  // Minden task delegálás előtt:
  getSocketService()?.emit('paios:task_created', { agent: t.agent, task: t.task });
  // Minden task után (ha van callback):
  getSocketService()?.emit('paios:agent_started', { agent: t.agent, taskId: id });
  ```

---

## Phase 4: Tesztek

* [ ] **Task 4.1** — `test/paiosOrchestrator.test.ts`
  ```typescript
  // Mock modelRouter + mock AgentManager
  vi.mock('../src/core/modelRouter.js', () => ({
    routeTask: vi.fn().mockResolvedValue(JSON.stringify({
      plan: [{ phase: 'Design', agent: 'SpecWriterAgent', task: 'Spec írás' }],
      tasks: [{ agent: 'SpecWriterAgent', task: 'Spec írás', priority: 'high' }],
      summary: 'Elkezdtem a tervezést.'
    }))
  }));
  // Test: POST /api/paios/chat → 200, summary megjelenik
  ```

* [ ] **Task 4.2** — `npm run build && npm test` → 0 hiba, minden ZÖLD

---

## 🎯 Sikerességi Kritériumok

- `POST /api/paios/chat { message: "Készíts egy specifikációt" }` → 200, JSON válasz summary-val
- Ha `model: "gemini"` → modelRouter Gemini providert hív
- Ha LLM JSON-t ad vissza → plan és tasks kitöltve, AgentManager-nek delegálva
- Ha LLM nem JSON-t ad → raw text kerül a summary-ba, nem crashel
- Socket.IO `paios:completed` event emittálódik
- `npm run build` → 0 TypeScript hiba
- `npm test` → minden PASS
