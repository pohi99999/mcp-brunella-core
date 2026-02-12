# Specifikáció: Task Decomposer Agent (Mikro-Ügynök Orchestrator)

**Track ID:** `task-decomposer-agent-20260211`
**Spec státusz:** `pending_approval`
**Dátum:** 2026-02-12
**Owner:** Claude

## 1. Cél

Komplex, több lépéses feladatok automatikus **dekompozíciója** mikro-taskokra, majd ezek **függőségek (DAG)** alapján történő végrehajtása (párhuzamosan ahol lehet), hibakezeléssel (retry/timeout), és vizualizációval (Dashboard + CLI).

EPP v2 kompatibilitás:

- ✅ Dashboard vizualizáció kötelező
- ✅ CLI (magyar) preview kötelező

## 2. Scope

### In-scope (Iteration 1)

- Agent core (TypeScript):
  - `decomposeTask(task: string) → MicroTask[]`
  - `buildExecutionGraph(tasks) → DAG`
  - `executeMicroTasks(graph) → Results`
- Safe default: **preview-only** mód (nem futtat automatikusan toolokat)
- CLI (magyar): dekompozíció preview megjelenítés
- Dashboard: DAG megjelenítés (react-flow), futtatás nélkül (csak preview)

### Out-of-scope (későbbi iteráció)

- Automatikus, eszközökkel való végrehajtás (MCP tool hívások) jóváhagyás nélkül
- “Auto-fix” jellegű beavatkozások (DeveloperAgent) emberi approval nélkül
- Kiterjedt persistálás/adatbázis (első körben memóriában / task contextben)

## 3. Adatmodell

```ts
export interface MicroTask {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeoutMs: number;
}

export interface DecompositionResult {
  originalTask: string;
  tasks: MicroTask[];
  dag: {
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ from: string; to: string }>;
  };
}
```

## 4. Safety / Governance

- Iteration 1-ben a rendszer **nem futtat** mikro-taskokat automatikusan.
- Később (Iteration 2+): execution csak approval flow-val, audit loggal.

## 5. API / Integráció

- Agent: új ügynök (pl. `TaskDecomposerAgent`) vagy modul a meglévő orchestrációban.
- Dashboard:
  - Komponens: `src/dashboard/components/dashboard/TaskDecompositionPanel.tsx` (vagy hasonló)
  - DAG render: react-flow
- CLI:
  - Magyar menüpont: `brunella task decompose` vagy a meglévő menürendszerbe illesztve

## 6. Tesztelés

- Unit: dekompozíció parser/validátor (stabil kimenet, nincs üres dependency)
- Unit: DAG builder (ciklus detektálás → hiba)
- Unit: preview-only garantálása (nincs tool hívás)
- Integráció (később): execution + retry/timeout szimuláció

## 7. Approval checklist

- [ ] Preview-only Iteration 1 elfogadva
- [ ] MicroTask schema elfogadva
- [ ] Dashboard + CLI felület elnevezések/útvonalak jók
- [ ] Teszt-stratégia OK
