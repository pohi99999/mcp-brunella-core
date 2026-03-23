# Specifikáció: Swarm Intelligence v2
**Track ID:** `swarm_intelligence_v2_20260323`
**Státusz:** active | **Prioritás:** MEDIUM
**Függőség:** agent_memory_structured_20260323, agent_orchestration_dag_20260323

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz |
|---|---|
| `src/core/swarm/colonyManager.ts` | ✅ Colony létrehozás, agent pool |
| `src/core/swarm/swarmAgent.ts` | ✅ SwarmAgent base class, bidding |
| `src/core/swarm/collectiveMind.ts` | ✅ SharedKnowledge, GroupDecision keretrendszer |
| `src/core/swarm/sharedCognition.ts` | ✅ Cognitive Sync alapok |
| **Colony perzisztencia** | ❌ Crash → teljes állapot elvész |
| **Weighted voting** | ❌ Egyszerű majority, nincs súlyozás |
| **Dynamic resizing** | ❌ Fix méretű colony |
| **Failure recovery** | ❌ Halott agent → egész colony megáll |

## 2. Colony Persistence Séma

```sql
CREATE TABLE colony_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colony_id TEXT NOT NULL,
  colony_name TEXT,
  state TEXT NOT NULL,              -- 'active' | 'paused' | 'completed'
  agents_json TEXT NOT NULL,        -- JSON: [{name, role, status, lastTask}]
  shared_knowledge_json TEXT,       -- JSON: colony-szintű tudás
  task_queue_json TEXT,             -- JSON: hátralevő feladatok
  completed_tasks INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(colony_id, created_at)
);
```

## 3. Weighted Voting Protocol

```typescript
interface Vote {
  agentId: string;
  option: string;        // szavazat
  confidence: number;    // 0-1
  reasoning: string;     // indoklás
  weight: number;        // auto-számolt: agent tapasztalat × confidence
}

interface VotingResult {
  winner: string;
  totalWeight: number;
  consensus: boolean;    // true ha >70% súlyozott egyetértés
  rounds: number;        // hány negotiation kör kellett
}
```

**Súly képlet:**
```
weight = agent.experienceScore × vote.confidence × agent.recentSuccessRate
```

- `experienceScore`: agent korábbi sikeres feladatok száma (memória track-ből)
- `recentSuccessRate`: utolsó 10 feladat sikerességi arány

## 4. Dynamic Resizing Logic

```
Colony terhelés monitoring:
  IF queue.length > agents.length × 3 → addAgent(bestAvailable)
  IF queue.length < agents.length × 0.5 → removeAgent(leastBusy)
  IF agent.failCount > 3 → respawn(agent, lastCheckpoint)
  
  Min agents: 2 (nem csökkenhet alá)
  Max agents: 10 (vagy config.maxColonySize)
```

## 5. Sikerességi Kritériumok

- [ ] Colony checkpoint mentés/visszaállítás SQLite-ben
- [ ] Auto-checkpoint: minden 5. feladat után
- [ ] Weighted voting: agent tapasztalat × confidence alapú súlyozás
- [ ] Negotiation: max 3 kör, deadlock → leader dönt
- [ ] Auto-scale: terhelés alapján agent ±
- [ ] Failure recovery: halott agent → respawn utolsó checkpoint
- [ ] Dashboard SwarmPanel + CLI `brunella swarm`
- [ ] `npm run build && npm test` → 0 hiba
