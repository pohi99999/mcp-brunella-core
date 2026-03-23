# Specifikáció: DAG Orchestráció
**Track ID:** `agent_orchestration_dag_20260323`
**Státusz:** active | **Prioritás:** HIGH
**Függőség:** observability_opentelemetry_20260323

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz |
|---|---|
| `types.ts` ChainStep/ChainContext | ✅ Szekvenciális chain |
| `adaptiveFlow.ts` | ✅ Metrika-alapú lépés újrarendezés |
| `geneticFlow.ts` | ✅ Genetikus algoritmus variáns szelekció |
| AgentHandoff | ✅ Egyszerű agent-to-agent delegálás |
| **Párhuzamos végrehajtás** | ❌ Minden lépés szekvenciális |
| **Conditional branching** | ❌ Nincs if/else a flow-ban |
| **Budget constraint** | ❌ Nincs token/cost limit |

## 2. DAG Node Típusok

```typescript
// src/core/dagEngine.ts
interface DAGNode {
  id: string;
  type: 'agent' | 'condition' | 'loop' | 'merge' | 'transform';
  agentName?: string;        // agent típusnál
  predicate?: (ctx: DAGContext) => boolean;  // condition típusnál
  maxIterations?: number;    // loop típusnál
  transform?: (data: unknown) => unknown;   // transform típusnál
  timeoutMs?: number;
  dependsOn: string[];       // bemeneti node-ok
}

interface DAGWorkflow {
  id: string;
  name: string;
  nodes: DAGNode[];
  budget?: { maxTokens?: number; maxCostUSD?: number; maxDurationMs?: number };
}

interface DAGExecutionResult {
  workflowId: string;
  status: 'completed' | 'partial' | 'failed' | 'budget_exceeded';
  nodeResults: Map<string, NodeResult>;
  totalTokens: number;
  totalCostUSD: number;
  durationMs: number;
}
```

## 3. Végrehajtási logika

```
DAG: [A] → [B] → [D]
     [A] → [C] → [D]

Execution:
  Round 1: [A] (no deps)
  Round 2: [B], [C] (parallel — both depend only on A)
  Round 3: [D] (depends on B + C — merge results)
```

Kahn's algorithm-mel topológiai rendezés, majd `Promise.allSettled()` a párhuzamos szinteken.

## 4. Conditional Branching

```typescript
// Példa: ha a research agent magas confidence-t ad → direkt végrehajtás, egyébként review
const workflow: DAGWorkflow = {
  nodes: [
    { id: 'research', type: 'agent', agentName: 'Researcher', dependsOn: [] },
    { id: 'check', type: 'condition', predicate: (ctx) => ctx.results['research'].confidence > 0.8, dependsOn: ['research'] },
    { id: 'execute', type: 'agent', agentName: 'Developer', dependsOn: ['check'] },   // true branch
    { id: 'review', type: 'agent', agentName: 'Evaluator', dependsOn: ['check'] },    // false branch
  ]
};
```

## 5. Sikerességi Kritériumok

- [ ] DAG engine: topológiai rendezés + párhuzamos végrehajtás
- [ ] Conditional branching: predicate-alapú branch választás
- [ ] Loop: max iteration limittel
- [ ] Budget: token/cost/duration limit enforcement
- [ ] Per-node timeout: graceful partial result
- [ ] TaskDecomposerAgent → DAG generálás
- [ ] Dashboard WorkflowPanel + CLI `brunella workflow`
- [ ] `npm run build && npm test` → 0 hiba
