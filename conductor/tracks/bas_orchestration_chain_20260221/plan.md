# Implementációs Terv: BAS Orchestration Chain v1
**Track ID:** `bas_orchestration_chain_20260221`

---

## Phase 1: OrchestratorAgent Chaining Refactor

* [ ] **Task 1.1** — `ChainContext` és `ChainStep` interfészek hozzáadása a `src/agents/types.ts`-be
  - `ChainStep { agentName, task, dependsOn? }`
  - `ChainContext { steps, currentStep, accumulated: AgentResponse[] }`

* [ ] **Task 1.2** — `OrchestratorAgent.executeChain(steps: ChainStep[]): Promise<AgentResponse>` metódus implementálása
  - Szekvenciális ciklus: minden step megkapja az előző `accumulated` outputját kontextusként
  - Ha egy step `status: 'error'` → chain megáll, hibát ad vissza a kontexttel együtt
  - `setAgentStatus('OrchestratorAgent', 'working', \`Step \${i+1}/\${steps.length}\`)`

* [ ] **Task 1.3** — `OrchestratorAgent.execute()` frissítése: komplex feladatok esetén (ha a task >50 karakter és >1 agent szükséges) automatikusan `executeChain()`-t hív

* [ ] **Task 1.4** — Teszt: `test/orchestratorChain.test.ts`
  - 3-lépéses mock chain: Step 1 output → Step 2 kontextus
  - Hibakezelés: Step 2 fail → chain leáll, Step 3 nem fut

---

## Phase 2: TaskDecomposer DAG → Valós Futás

* [ ] **Task 2.1** — `TaskDecomposerAgent.ts`: `preview: boolean` paraméter hozzáadása az `execute()` metódushoz (default: `true`, backward compat)
  - Ha `preview: false`: visszaadja a `ChainStep[]` tömböt az OrchestratorAgent számára

* [ ] **Task 2.2** — Kahn-algoritmus implementálása: `src/utils/dagSort.ts`
  - Input: `ChainStep[]` (with `dependsOn` edges)
  - Output: topológiailag rendezett `ChainStep[]`
  - Circular dependency detektálás → error throw

* [ ] **Task 2.3** — `src/agents/registry.json` frissítése: `task_decomposer` entry-nél `"autoStart": false` → `"autoStart": true` (a chain ezt használja)

* [ ] **Task 2.4** — Teszt: `test/dagSort.test.ts`
  - Lineáris DAG (A→B→C) helyes sorrendje
  - Elágazó DAG (A→C, B→C) helyes sorrendje
  - Kör detektálás (A→B→A) → hibadobás

---

## Phase 3: SystemArchitectureWidget + CLI

* [ ] **Task 3.1** — Backend: `GET /api/system/architecture-status` endpoint (`src/server/routes/system.ts`)
  ```typescript
  // Visszaad:
  {
    ingestion: { lancedbRows: number, lastHarvestAt: string | null },
    knowledge: { sqliteTasksPending: number, sqliteTasksDone: number },
    orchestration: { activeAgents: number, idleAgents: number, chainRunning: boolean },
    security: { sandboxEnabled: boolean, guardrailFlags: number, goldenSamples: number }
  }
  ```

* [ ] **Task 3.2** — `SystemArchitectureWidget.tsx` létrehozása (`src/dashboard/components/dashboard/`)
  - 4 kártyás layout (Radix UI Card + Tailwind v4)
  - Valós idejű polling: 10 másodpercenként `GET /api/system/architecture-status`
  - Minden kártyán: státusz badge (green/yellow/red) + fő metrika

* [ ] **Task 3.3** — `src/dashboard/lib/apiService.ts` bővítése: `getArchitectureStatus()` metódus

* [ ] **Task 3.4** — `src/dashboard/lib/navigation.tsx` NavigationRegistry bővítése: `system-arch` item regisztrálása a "Core Systems" groupba

* [ ] **Task 3.5** — `src/cli-hu.ts` bővítése: `brunella system arch` parancs
  - Táblázatos output (chalk + boxen)
  - `--json` flag: raw JSON output

* [ ] **Task 3.6** — `npm run test:full` — 0 hiba, minden teszt ZÖLD

---

## 🛡️ Sikerességi Kritériumok

- `orchestrator.executeChain(['research', 'code', 'evaluate'])` egy 3-lépéses pipeline-t hajt végre, ahol lépés 2 megkapja lépés 1 outputját
- A DAG sort kör esetén hibadobással véd
- `GET /api/system/architecture-status` valós adatot ad vissza (nem mock)
- `brunella system arch` futtatható és olvasható outputot ad
- `npm run build` → 0 hiba
- `npm test` → minden PASS
