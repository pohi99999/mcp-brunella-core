# Implementációs Terv: DAG Orchestráció
**Track ID:** `agent_orchestration_dag_20260323`

---

## Phase 1: DAG Engine Core

* [ ] **Task 1.1** — `src/core/dagEngine.ts` alap interfészek
  - DAGNode, DAGEdge, DAGWorkflow, DAGContext, NodeResult
  - DAGExecutionResult: status, nodeResults, totalTokens, cost, duration

* [ ] **Task 1.2** — Topológiai rendezés (Kahn's algorithm)
  - `topologicalSort(nodes)`: execution order meghatározás
  - Cycle detection: hiba ha kör van a gráfban
  - Unreachable node warning

* [ ] **Task 1.3** — Párhuzamos végrehajtás
  - `executeDAG(workflow, initialContext)`: fő végrehajtó
  - Execution rounds: azonos szinten lévő node-ok → `Promise.allSettled()`
  - Result propagálás: node output → dependens node-ok input

* [ ] **Task 1.4** — Tesztek: `test/orchestration/dagEngine.test.ts`
  - Lineáris DAG (A→B→C)
  - Diamond DAG (A→B,C→D)
  - Cycle detection error

## Phase 2: Conditional & Loop Support

* [ ] **Task 2.1** — ConditionalNode
  - `predicate(context)` → true/false branch selection
  - True branch: dependsOn node-ok futnak
  - False branch: alternatív node-ok futnak

* [ ] **Task 2.2** — LoopNode
  - `while(condition(ctx))` ismétlés maxIterations limittel
  - Loop body: sub-DAG végrehajtás
  - Loop result: utolsó iteráció eredménye

* [ ] **Task 2.3** — Error branch
  - Bármely node hiba → error handler node (ha definiálva)
  - Default: skip + partial result

## Phase 3: Budget & Timeout

* [ ] **Task 3.1** — Budget tracker
  - `DAGBudget`: { maxTokens, maxCostUSD, maxDurationMs }
  - Real-time tracking: minden node után összesítés
  - Budget exceeded → `status: 'budget_exceeded'` + eddigi eredmények

* [ ] **Task 3.2** — Per-node timeout
  - `node.timeoutMs`: node-szintű timeout
  - Timeout → partial result + warning (nem crash)
  - `Promise.race([nodeExecution, timeoutPromise])`

## Phase 4: Integration + Dashboard + CLI

* [ ] **Task 4.1** — TaskDecomposerAgent → DAG generálás
  - `decomposeToDAG(task)`: task szöveg → DAGWorkflow
  - Intelligens függőség felismerés (NLP alapú)

* [ ] **Task 4.2** — AgentManager integráció
  - `executeWorkflow(dag)` metódus
  - Trace span per workflow (OpenTelemetry)

* [ ] **Task 4.3** — Dashboard: `WorkflowPanel.tsx`
  - DAG vizualizáció (node graph)
  - Execution state: pending/running/done/error szín-kódolás
  - Navigation regisztráció

* [ ] **Task 4.4** — CLI: `src/cli/commands/workflow-hu.ts`
  - `brunella workflow run <task>`: DAG futtatás
  - `brunella workflow status`: futó workflow-k
  - Inquirer menü, magyar nyelv

---

## 🎯 Sikerességi Kritériumok

1. Diamond DAG (A→B,C→D) párhuzamosan fut
2. Conditional: branch selection predicate alapján
3. Budget: token limit → early termination
4. Timeout: per-node timeout → partial result
5. Dashboard WorkflowPanel + CLI `brunella workflow`
6. Összes teszt PASS
