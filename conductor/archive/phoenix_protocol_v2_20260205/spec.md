# Phoenix Protocol v2 - Öngyógyító Rendszer

## Összefoglaló
A Phoenix Protocol a BAS "immunrendszere" - biztosítja, hogy a rendszer hibáktól ne összeomoljon, hanem automatikusan helyreálljon és tanuljon belőlük.

## Jelenlegi Állapot
- ✅ `systemHealth.ts` - Szolgáltatás monitoring
- ✅ `AgentManager` - Alapvető try-catch
- ❌ Formális checkpoint rendszer hiányzik
- ❌ State restoration logika hiányzik
- ❌ Graceful degradation nincs

## Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                    PHOENIX PROTOCOL                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. DETECT           2. RESTART         3. RESTORE          │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐        │
│  │Heartbeat │──────►│Silent    │──────►│State     │        │
│  │Monitor   │       │Restart   │       │Recovery  │        │
│  │(5s ping) │       │(no crash)│       │(checkpoint)       │
│  └──────────┘       └──────────┘       └──────────┘        │
│       │                                       │              │
│       │              4. ISOLATE               │              │
│       │            ┌──────────┐              │              │
│       └───────────►│Graceful  │◄─────────────┘              │
│                    │Degradation              │              │
│                    │(partial ok)│                           │
│                    └──────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## 4 Fázis Részletesen

### 1. Detektálás (Heartbeat Monitor)
**Fájl:** `src/utils/heartbeatMonitor.ts`

```typescript
interface HeartbeatConfig {
  interval: 5000;        // 5 másodperc
  timeout: 10000;        // 10 mp timeout
  maxRetries: 3;         // 3 próbálkozás
}

class HeartbeatMonitor {
  private services: Map<string, ServiceStatus>;

  async checkService(name: string): Promise<HealthStatus> {
    // HTTP ping vagy process check
  }

  onFailure(service: string, callback: FailureHandler): void {
    // Hiba esetén callback
  }
}
```

**Monitorozott szolgáltatások:**
| Szolgáltatás | Ellenőrzés | Timeout |
|--------------|------------|---------|
| Ollama | GET :11434/api/tags | 5s |
| FastAPI | GET :8000/health | 3s |
| Dashboard | GET :5173 | 3s |
| Python Shell | Process alive | 1s |

### 2. Silent Restart (Defibrillátor)
**Fájl:** `src/agents/AgentManager.ts` (bővítés)

```typescript
async executeWithRecovery(agent: IAgent, task: string): Promise<AgentResponse> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await agent.execute(task);
    } catch (error) {
      logWarn(`Attempt ${attempt} failed: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        await this.restartService(agent.runtime);
        await this.restoreState(agent.name);
      }
    }
  }

  // Graceful degradation
  return { status: 'degraded', error: 'Max retries exceeded' };
}
```

### 3. State Restoration (Checkpoint System)
**Fájl:** `src/utils/checkpoint.ts`

```typescript
interface Checkpoint {
  id: string;
  timestamp: Date;
  agent: string;
  state: Record<string, unknown>;
  taskQueue: Task[];
}

class CheckpointManager {
  private storage: string = 'logs/checkpoints/';

  async save(agent: string, state: unknown): Promise<string> {
    const id = `${agent}_${Date.now()}`;
    await fs.writeJSON(`${this.storage}/${id}.json`, {
      id,
      timestamp: new Date(),
      agent,
      state
    });
    return id;
  }

  async restore(agent: string): Promise<Checkpoint | null> {
    // Legfrissebb checkpoint betöltése
    const files = await glob(`${this.storage}/${agent}_*.json`);
    if (files.length === 0) return null;

    const latest = files.sort().pop();
    return fs.readJSON(latest);
  }
}
```

**Checkpoint mentési pontok:**
- Task végrehajtás előtt
- Sikeres validáció után
- Adatbázis írás után
- Ügynök váltáskor

### 4. Graceful Degradation
**Fájl:** `src/utils/degradationPolicy.ts`

```typescript
interface DegradationLevel {
  level: 'full' | 'partial' | 'minimal' | 'offline';
  availableServices: string[];
  message: string;
}

const DEGRADATION_POLICY: Record<string, DegradationLevel> = {
  'ollama_down': {
    level: 'partial',
    availableServices: ['dashboard', 'api', 'file_ops'],
    message: 'LLM szolgáltatás nem elérhető, alap funkciók működnek'
  },
  'python_down': {
    level: 'partial',
    availableServices: ['chat', 'agents', 'dashboard'],
    message: 'Python alrendszer újraindul...'
  },
  'all_healthy': {
    level: 'full',
    availableServices: ['*'],
    message: 'Minden szolgáltatás működik'
  }
};
```

## Mérföldkövek

- [ ] `heartbeatMonitor.ts` implementálás
- [ ] `checkpoint.ts` implementálás
- [ ] `degradationPolicy.ts` implementálás
- [ ] AgentManager recovery logika
- [ ] Dashboard status indicator (degraded mode)
- [ ] Checkpoint retention policy (7 nap)
- [ ] Recovery metrics logging

## Konfigurálható Paraméterek

```env
# .env
PHOENIX_HEARTBEAT_INTERVAL=5000
PHOENIX_MAX_RETRIES=3
PHOENIX_CHECKPOINT_RETENTION_DAYS=7
PHOENIX_DEGRADATION_NOTIFY=true
```

## Monitoring Dashboard

```
┌─────────────────────────────────────┐
│ SYSTEM HEALTH          🟢 HEALTHY  │
├─────────────────────────────────────┤
│ Ollama       🟢 OK     12ms        │
│ FastAPI      🟢 OK     45ms        │
│ Dashboard    🟢 OK     8ms         │
│ Python Shell 🟢 OK     active      │
├─────────────────────────────────────┤
│ Last checkpoint: 2 min ago         │
│ Restarts today: 0                  │
│ Uptime: 99.8%                      │
└─────────────────────────────────────┘
```

## Kockázatok

1. **Checkpoint storage:** Sok checkpoint → disk space
2. **State incompatibility:** Új verzió régi checkpoint-tal
3. **Cascade failure:** Minden szolgáltatás egyszerre

## Kapcsolódó Trackek
- `data_flywheel_incubator` - Checkpoint-olt training
- `mission_control_dashboard` - Health visualization
