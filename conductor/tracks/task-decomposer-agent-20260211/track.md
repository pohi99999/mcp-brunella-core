# Track: Task Decomposer Agent (Mikro-Ügynök Orchestrator)

**Status:** IN_PROGRESS (Iteration 1: preview-only ✅)
**Priority:** P2
**Complexity:** HIGH
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Komplex feladatok automatikus dekompozíciója mikro-task-okra, dependency resolution, párhuzamos/szekvenciális végrehajtás, fault tolerance.

## ✅ Acceptance Criteria

1. LLM-alapú task analízis és dekompozíció _(későbbi iteráció)_
2. Dependency graph építés (DAG) ✅ _(preview)_
3. Párhuzamos végrehajtás ahol lehetséges _(későbbi iteráció – execution)_
4. Retry mechanizmus + timeout protection _(későbbi iteráció – execution)_
5. **Dashboard:** Task decompose vizualizáció (graph view) ✅ _(preview)_
6. **CLI:** Task decompose preview (magyar) ✅

## 🔧 Technikai Követelmények

### Agent (Iteration 1 - preview-only)

- `src/agents/taskDecomposerCore.ts` – determinisztikus mikro-task + DAG builder
- `src/agents/TaskDecomposerAgent.ts` – `task_decomposer` agent (preview-only)
- `src/agents/registry.json` – agent regisztráció

```typescript
interface MicroTask {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeoutMs: number;
}

// Iteration 1:
decomposePreview(task: string): { tasks: MicroTask[]; dag: { nodes; edges } }
```

### Dashboard (Iteration 1)

- `src/dashboard/components/dashboard/TaskDecomposerPanel.tsx`
- Bekötve a sidebarba: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (tab: `decomposer`)

- Task input textarea
- "Dekompozíció" button
- DAG visualization (react-flow)
- **Nincs execution** (preview-only)

### CLI (Iteration 1)

- `src/cli/taskDecomposerCommands.ts`
- Regisztrálva: `src/cli.ts`

```bash
brunella decompose [task]
```

## ✅ Iteration 1 - Kész (Preview-only)

- Agent: `task_decomposer` (nem futtat toolokat)
- Dashboard: DAG preview (ReactFlow)
- CLI: `brunella decompose` (HU)
- Teszt: `test/taskDecomposerCore.test.ts`

**Használat:**

- Dashboard → bal sidebar → **Decompose**
- CLI → `brunella decompose "..."`

## 📋 Implementation Plan

### Phase 1: Agent Core

- [x] Core (preview): mikro-task + DAG + cycle detect
- [ ] LLM integration (task analysis)
- [ ] Executor (parallel/sequential)
- [ ] Retry + timeout handling
- [x] Unit tesztek (core)

### Phase 2: Dashboard Visualization

- [x] TaskDecomposerPanel (textarea + run)
- [x] DAG visualization (react-flow)
- [ ] Real-time execution status _(későbbi iteráció – execution)_
- [ ] Results aggregation _(későbbi iteráció – execution)_
- [x] Dashboard integráció (MissionControlLayout tab)

### Phase 3: CLI Interface

- [x] Preview mode (no execution)
- [ ] Execute mode (with progress) _(későbbi iteráció – execution)_
- [x] Results display (task lista)
- [x] CLI regisztráció

### Phase 4: Testing

- [ ] Complex task test (multi-level dependencies)
- [ ] Parallel execution test _(későbbi iteráció – execution)_
- [ ] Retry mechanism test _(későbbi iteráció – execution)_
- [ ] Dashboard + CLI test _(opcionális – e2e)_
- [x] npm test

### Phase 5: Deployment

- [ ] README.md frissítés
- [x] GitHub commit

## 📝 Implementation Prompt

```text
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
