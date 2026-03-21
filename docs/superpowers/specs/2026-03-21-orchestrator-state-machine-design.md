# Design Spec: OrchestratorAgent LangGraph-inspirált State Machine

**Dátum:** 2026-03-21
**Track:** orchestrator_state_machine_20260321 (ÚJ track)
**Státusz:** APPROVED

---

## Összefoglalás

A LangGraph state machine mintáját implementáljuk az `OrchestratorAgent`-be — **külső dependency nélkül**, pure TypeScript-ben. Az explicit állapotgép kiszámítható, debuggolható, rollback-képes orkesztrációt ad, és teljes mértékben integrálódik a meglévő Phoenix Protocol checkpoint rendszerrel.

---

## Probléma

A jelenlegi `OrchestratorAgent.ts`:
- Keyword routing array + LLM fallback → implicit flow, nehezen nyomkövetehető
- Nincs explicit állapot → ha egy lépés félúton megáll, nem tudni hol tartunk
- Nincs rollback → hiba esetén az orchestrator "elveszik"
- Nehéz unit tesztelni (a flow az egész függvényen belül van)

**LangGraph inspiráció:** Explicit state node-ok, guard transition-ök, checkpoint integration.

---

## Megközelítés

### Választott megközelítés: Belső TypeScript State Machine

**Miért NEM LangChain/LangGraph dependency?**
- A projekt ESM + TypeScript, LangGraph Python-első (TS support gyenge)
- Brunella már tartalmaz checkpoint.ts + phoenixEventBus.ts → nincs szükség duplikálásra
- Egyszerűbb = könnyebb debug, kevesebb breaking change kockázat

**Architektúra:** `AgentStateMachine<S extends string>` generikus osztály, amelyet az `OrchestratorAgent` felhasznál.

---

## Állapotok (States)

```
IDLE
  ↓ [taskReceived]
ANALYZING          ← LLM: feladat értelmezés, komplexitás becslés
  ↓ [analysisComplete]
ROUTING            ← keyword matching → agent selection → capability check
  ↓ [agentSelected]
EXECUTING          ← agent.execute(task, context) hívás
  ↓ [executionComplete]
REVIEWING          ← EvaluatorAgent quality check (ha szükséges)
  ↓ [reviewPassed] / [reviewFailed → EXECUTING retry]
DONE

Bármely állapotból:
  [errorOccurred] → ERROR
  ERROR → [retry < maxRetries] → ANALYZING
  ERROR → [retry >= maxRetries] → FAILED
```

---

## Architektúra

### Komponensek

```
src/core/agentStateMachine.ts   ← ÚJ: generikus state machine engine
src/agents/OrchestratorAgent.ts ← MÓDOSÍTÁS: state machine integrálás
```

### `AgentStateMachine<S>` osztály

```typescript
// src/core/agentStateMachine.ts

export interface StateNode<S extends string> {
  name: S;
  onEnter?: (ctx: MachineContext) => Promise<void>;
  onExit?: (ctx: MachineContext) => Promise<void>;
}

export interface Transition<S extends string> {
  from: S;
  to: S;
  event: string;
  guard?: (ctx: MachineContext) => boolean;  // Feltétel
}

export interface MachineContext {
  task: string;
  agentName?: string;
  result?: unknown;
  error?: string;
  retryCount: number;
  checkpointId?: string;
}

export class AgentStateMachine<S extends string> {
  private current: S;
  private context: MachineContext;

  constructor(
    private states: StateNode<S>[],
    private transitions: Transition<S>[],
    initialState: S
  ) { ... }

  async transition(event: string): Promise<S>
  getState(): S
  getContext(): MachineContext
  async saveCheckpoint(): Promise<void>     // Phoenix Protocol integráció
  async loadCheckpoint(id: string): Promise<void>
}
```

### OrchestratorAgent integrálás

```typescript
// OrchestratorAgent.ts — refaktorált execute()

async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
  const machine = new AgentStateMachine<OrchestratorState>(
    ORCHESTRATOR_STATES,
    ORCHESTRATOR_TRANSITIONS,
    'IDLE'
  );

  await machine.transition('taskReceived');    // IDLE → ANALYZING
  const analysis = await this.analyzeTask(task);

  await machine.transition('analysisComplete'); // ANALYZING → ROUTING
  const agentName = await this.selectAgent(analysis);

  await machine.transition('agentSelected');   // ROUTING → EXECUTING
  const result = await this.executeAgent(agentName, task);

  if (needsReview(result)) {
    await machine.transition('executionComplete'); // → REVIEWING
    // ...
  }

  await machine.transition('done');
  return { status: 'success', data: result };
}
```

---

## Phoenix Protocol Integráció

Az `AgentStateMachine` minden állapotváltáskor meghívja a `saveCheckpoint()` metódust:

```typescript
// Checkpoint state tartalmaz:
{
  machineState: 'EXECUTING',
  context: { task, agentName, retryCount: 0 },
  timestamp: Date.now()
}
```

Restart esetén: `loadCheckpoint()` → folytatás az utolsó stabil állapotból.

---

## Érintett fájlok

| Fájl | Módosítás típusa |
|------|-----------------|
| `src/core/agentStateMachine.ts` | **ÚJ** |
| `src/agents/OrchestratorAgent.ts` | refaktorálás (visszafelé kompatibilis!) |
| `test/agentStateMachine.test.ts` | **ÚJ** unit tesztek |
| `conductor/tracks/orchestrator_state_machine_20260321/meta.json` | track |

---

## Backward Compatibility

- Az `OrchestratorAgent.execute()` szignatúrája **nem változik**
- A `IAgent` interfész **nem változik**
- Meglévő keyword routing megmarad — a state machine *burkolja*, nem helyettesíti
- Ha a state machine hiba → fallback az eredeti flow-ra

---

## Tesztelés

```typescript
// test/agentStateMachine.test.ts
describe('AgentStateMachine', () => {
  it('transitions IDLE → ANALYZING on taskReceived', async () => { ... });
  it('saves checkpoint on each transition', async () => { ... });
  it('handles ERROR → retry < maxRetries', async () => { ... });
  it('reaches FAILED after maxRetries', async () => { ... });
  it('restores state from checkpoint', async () => { ... });
});
```

---

## Siker kritériumok

- [ ] `AgentStateMachine` unit tesztek PASS
- [ ] `OrchestratorAgent` ugyanazokat az eredményeket adja (backward compat)
- [ ] Phoenix Protocol checkpoint: restart után folytatja az előző állapotból
- [ ] `npm test` PASS
- [ ] Dashboard: OrchestratorAgent state visible (IDLE/ANALYZING/EXECUTING/DONE)
