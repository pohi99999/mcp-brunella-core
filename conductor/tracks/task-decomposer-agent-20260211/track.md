# Track: Task Decomposer Agent (Mikro-Ügynök Orchestrator)

**Status:** PROPOSED
**Priority:** P2
**Complexity:** HIGH
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Komplex feladatok automatikus dekompozíciója mikro-task-okra, dependency resolution, párhuzamos/szekvenciális végrehajtás, fault tolerance.

## ✅ Acceptance Criteria

1. LLM-alapú task analízis és dekompozíció
2. Dependency graph építés (DAG)
3. Párhuzamos végrehajtás ahol lehetséges
4. Retry mechanizmus + timeout protection
5. **Dashboard:** Task execution vizualizáció (graph view)
6. **CLI:** Task decompose preview (magyar)

## 🔧 Technikai Követelmények

### Agent: src/agents/task-decomposer.ts
```typescript
interface MicroTask {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeout: number;
}

async decomposeTask(task: string): Promise<MicroTask[]>
async buildExecutionGraph(tasks: MicroTask[]): Promise<Map>
async executeMicroTasks(graph: Map): Promise<Results>
```

### Dashboard: src/dashboard/components/TaskDecomposition.tsx
- Task input textarea
- "Dekompozíció" button
- DAG visualization (d3.js vagy react-flow)
- Execution progress (real-time)
- Results aggregation

### CLI: src/cli-commands/decompose-hu.ts
```
1. 🧩 Feladat dekompozíció preview
2. 🚀 Feladat végrehajtás
3. 📊 Utolsó decompose eredmény
4. 🔙 Vissza
```

## 📋 Implementation Plan

### Phase 1: Agent Core
- [ ] task-decomposer.ts implementáció
- [ ] LLM integration (task analysis)
- [ ] Dependency graph builder
- [ ] Parallel/sequential executor
- [ ] Retry + timeout handling
- [ ] Unit tesztek

### Phase 2: Dashboard Visualization
- [ ] TaskDecomposition.tsx komponens
- [ ] DAG visualization (react-flow)
- [ ] Real-time execution status
- [ ] Results display
- [ ] Dashboard integráció

### Phase 3: CLI Interface
- [ ] decompose-hu.ts létrehozás
- [ ] Preview mode (no execution)
- [ ] Execute mode (with progress)
- [ ] Results display
- [ ] CLI regisztráció

### Phase 4: Testing
- [ ] Complex task test (multi-level dependencies)
- [ ] Parallel execution test
- [ ] Retry mechanism test
- [ ] Dashboard + CLI test
- [ ] npm test

### Phase 5: Deployment
- [ ] README.md frissítés
- [ ] GitHub commit

## 📝 Implementation Prompt

```
TaskDecomposerAgent implementálás:

Agent:
- LLM-alapú task analysis (Ollama)
- Dependency graph (DAG)
- Párhuzamos végrehajtás
- Fault tolerance (retry + timeout)

Dashboard:
- Task decomposition UI
- DAG visualization (react-flow)
- Real-time execution status

CLI:
- Magyar dekompozíció parancsok
- Preview + Execute mode
```
