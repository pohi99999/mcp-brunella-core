# Design Spec: OWL-inspirált Multi-Agent Conflict Resolution

**Dátum:** 2026-03-21
**Track:** owl_agent_coordinator_20260321 (ÚJ track)
**Státusz:** APPROVED

---

## Összefoglalás

Az OWL Multi-Agent Collaboration Framework inspirálta `AgentCoordinator` komponens beépítése a Brunella rendszerbe. Ráépül a meglévő `permissions.ts` + `AgentManager.ts` párra — **külső dependency nélkül**. Megoldja: prioritásvita, capability negotiation, deadlock detection a 56+ agent között.

---

## Probléma

A jelenlegi AgentManager:
- Task Queue (SQLite) + Worker Loop → van, de nincs koordináció
- Ha DeveloperAgent és EvaluatorAgent ugyanarra a fájlra ír egyszerre → race condition
- Nincs "melyik agent a legalkalmasabb erre a feladatra?" logika (csak name-based routing)
- Nincs deadlock védelem (Agent A vár Agent B-re, B vár A-ra)
- 56+ agent → koordinált döntéshozás nélkül kezelhetetlen

---

## OWL ötletek — Brunella adaptáció

| OWL koncept | Brunella implementáció |
|-------------|----------------------|
| Agent role specialization | `capabilities[]` a registry.json-ban (meglévő) |
| Task delegation | `AgentManager.executeAgent()` (meglévő) |
| **Conflict resolution** | **ÚJ: AgentCoordinator.resolveConflict()** |
| **Capability negotiation** | **ÚJ: AgentCoordinator.negotiateTask()** |
| **Deadlock detection** | **ÚJ: DeadlockDetector (periodic cron)** |

---

## Architektúra

### Komponensek

```
src/core/agentCoordinator.ts     ← ÚJ: conflict resolution + negotiation
src/core/deadlockDetector.ts     ← ÚJ: circular wait detection
src/agents/AgentManager.ts       ← MÓDOSÍTÁS: coordinator hook-ok beépítése
src/agents/permissions.ts        ← MÓDOSÍTÁS: resource lock mechanizmus
```

### AgentCoordinator

```typescript
// src/core/agentCoordinator.ts

export interface ResourceLock {
  resource: string;       // pl. "file:src/agents/DeveloperAgent.ts"
  agentName: string;
  acquiredAt: number;
  ttl: number;            // ms — automatikus feloldás
}

export interface NegotiationResult {
  winner: string;          // agent neve
  reason: string;          // "highest_capability_match" | "highest_priority" | "least_loaded"
  alternatives: string[];  // fallback sorrendben
}

export class AgentCoordinator {
  private locks = new Map<string, ResourceLock>();

  // Melyik agent csinálja a feladatot?
  async negotiateTask(task: string, candidates: string[]): Promise<NegotiationResult>

  // Erőforrás zárolás (race condition megelőzés)
  async acquireLock(agentName: string, resource: string, ttl?: number): Promise<boolean>
  async releaseLock(agentName: string, resource: string): Promise<void>

  // Prioritásvita feloldása
  resolveConflict(agent1: string, agent2: string, resource: string): string

  // Összes lock státusz
  getLocks(): ResourceLock[]
}
```

### Capability Negotiation logika

```typescript
async negotiateTask(task: string, candidates: string[]): Promise<NegotiationResult> {
  const scores = await Promise.all(candidates.map(async (agentName) => {
    const config = registry.getConfig(agentName);
    const capabilityScore = matchCapabilities(task, config.capabilities);
    const priorityScore = config.priority / 100;        // registry.json priority
    const loadScore = 1 - (activeTaskCount(agentName) / MAX_CONCURRENT);

    return {
      agentName,
      score: capabilityScore * 0.5 + priorityScore * 0.3 + loadScore * 0.2
    };
  }));

  scores.sort((a, b) => b.score - a.score);
  return {
    winner: scores[0].agentName,
    reason: 'capability_weighted_score',
    alternatives: scores.slice(1).map(s => s.agentName)
  };
}
```

### DeadlockDetector

```typescript
// src/core/deadlockDetector.ts

export class DeadlockDetector {
  // Wait-for graph: agentA vár agentB-re (mert B foglalja a resource-t amit A akar)
  private waitGraph = new Map<string, Set<string>>();

  // Ciklus keresés (Kahn-algoritmus / DFS)
  detectCycles(): string[][] // Visszaadja az összes deadlock ciklust

  // Feloldás: legkisebb prioritású agent task-ját megszakítja
  async resolveDeadlock(cycle: string[]): Promise<void>

  // 30 másodpercenként futó ellenőrzés
  startMonitoring(intervalMs = 30_000): void
  stopMonitoring(): void
}
```

### AgentManager integráció (minimális változás)

```typescript
// AgentManager.ts — executeTask módosítás
async executeTask(agentName: string, task: string): Promise<void> {
  // ÚJ: koordinátor lock
  const resource = `agent:${agentName}:exclusive`;
  const lockAcquired = await agentCoordinator.acquireLock(agentName, resource, 30_000);

  if (!lockAcquired) {
    // Capability negotiation: ki csinálja helyette?
    const candidates = await registry.getAlternatives(agentName, task);
    const negotiated = await agentCoordinator.negotiateTask(task, candidates);
    agentName = negotiated.winner;
  }

  try {
    await agent.execute(task);
  } finally {
    await agentCoordinator.releaseLock(agentName, resource);
  }
}
```

---

## Prioritási sorrend (Conflict Resolution)

Konfliktusnál (2 agent ugyanazt a resource-t akarja):

1. **ADMIN permission** → előnyt élvez
2. **Registry priority** (registry.json `priority` mező, 0-100)
3. **Task age** → régebbi task előnyt élvez (starvation prevention)
4. **Capability match score** → specializáltabb agent

---

## Dashboard Panel

```tsx
// src/dashboard/components/dashboard/AgentCoordinatorPanel.tsx
// Mutatja:
// - Aktív lock-ok listája (agent, resource, TTL)
// - Deadlock detections (utolsó 24h)
// - Negotiation log (ki nyert, miért)
// - Agent load heatmap (56 agent terhelési szintje)
```

---

## Érintett fájlok

| Fájl | Módosítás típusa |
|------|-----------------|
| `src/core/agentCoordinator.ts` | **ÚJ** |
| `src/core/deadlockDetector.ts` | **ÚJ** |
| `src/agents/AgentManager.ts` | minimális módosítás (hook-ok) |
| `src/agents/permissions.ts` | resource lock enum hozzáadás |
| `src/dashboard/components/dashboard/AgentCoordinatorPanel.tsx` | **ÚJ** |
| `src/dashboard/lib/navigation.tsx` | regisztráció |
| `test/agentCoordinator.test.ts` | **ÚJ** |
| `test/deadlockDetector.test.ts` | **ÚJ** |

---

## Tesztelés

```typescript
describe('AgentCoordinator', () => {
  it('negotiates task to highest capability agent', async () => { ... });
  it('acquires and releases resource locks', async () => { ... });
  it('resolves conflict by priority', async () => { ... });
  it('prevents lock starvation via TTL', async () => { ... });
});

describe('DeadlockDetector', () => {
  it('detects A→B→A circular dependency', async () => { ... });
  it('resolves deadlock by preempting lowest priority agent', async () => { ... });
  it('no false positives on non-circular waits', async () => { ... });
});
```

---

## Siker kritériumok

- [ ] `AgentCoordinator` unit tesztek PASS
- [ ] `DeadlockDetector` detektál és felold egy szimulált deadlock-ot
- [ ] AgentManager: meglévő tesztek PASS (backward compat)
- [ ] Dashboard: AgentCoordinatorPanel mutatja az aktív lock-okat
- [ ] CLI: `brunella agents conflicts` → aktív lock-ok + utolsó deadlock
- [ ] `npm test` PASS
