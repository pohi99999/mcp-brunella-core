# OrchestratorAgent State Machine — Implementációs Terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `AgentStateMachine<S>` generikus TypeScript engine implementálása és beépítése az OrchestratorAgent-be — explicit állapotokkal, Phoenix Protocol checkpointtal, külső dependency nélkül.

**Architecture:** Két réteg: (1) generikus `AgentStateMachine<S>` osztály `src/core/`-ban, amely állapotokat, átmeneteket és checkpoint mentést kezel; (2) OrchestratorAgent refaktorálás, amely a meglévő 3 execution path-t (Studio / Keyword / ReAct) állapotgép állapotokba csomagolja. Visszafelé kompatibilis — az `IAgent` interfész és az `execute()` szignatúra nem változik.

**Tech Stack:** TypeScript ESM, `better-sqlite3` (checkpoint.ts-en keresztül), `phoenixEventBus` (meglévő, `phoenix:state_restored` event használat), Vitest (tesztek)

---

## Fájlstruktúra

| Fájl | Szerep |
|------|--------|
| `src/core/agentStateMachine.ts` | **ÚJ** — generikus state machine engine (StateNode, Transition, MachineContext, AgentStateMachine class) |
| `src/agents/OrchestratorAgent.ts` | **MÓDOSÍTÁS** — state machine wrap az execute() köré; getCurrentState() metódus |
| `test/agentStateMachine.test.ts` | **ÚJ** — 6 unit teszt az engine-hez |

---

## Task 1: AgentStateMachine engine — alap osztály

**Files:**
- Create: `src/core/agentStateMachine.ts`
- Create: `test/agentStateMachine.test.ts`

### Lépések

- [ ] **1.1 Írjuk meg az első failing tesztet**

```typescript
// test/agentStateMachine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// FONTOS: vi.mock() MINDIG a fájl szintjén kell legyen (Vitest hoisting!)
vi.mock('../src/core/checkpoint.js', () => ({
  saveCheckpoint: vi.fn().mockResolvedValue(1),
  loadCheckpoint: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import { AgentStateMachine, type StateNode, type Transition, type MachineContext } from '../src/core/agentStateMachine.js';

type TestState = 'IDLE' | 'WORKING' | 'DONE' | 'ERROR';

function makeSimpleMachine(taskId = 'test-1') {
  const states: StateNode<TestState>[] = [
    { name: 'IDLE' },
    { name: 'WORKING' },
    { name: 'DONE' },
    { name: 'ERROR' },
  ];
  const transitions: Transition<TestState>[] = [
    { from: 'IDLE',    to: 'WORKING', event: 'start' },
    { from: 'WORKING', to: 'DONE',    event: 'finish' },
    { from: 'WORKING', to: 'ERROR',   event: 'fail' },
  ];
  return new AgentStateMachine<TestState>(states, transitions, 'IDLE', taskId);
}

describe('AgentStateMachine', () => {
  it('starts in the initial state', () => {
    const m = makeSimpleMachine();
    expect(m.getState()).toBe('IDLE');
  });
});
```

- [ ] **1.2 Futtasd a tesztet (FAIL elvárt)**

```bash
npx vitest run test/agentStateMachine.test.ts
```
Elvárt: `Error: Cannot find module '../src/core/agentStateMachine.js'`

- [ ] **1.3 Implementáld az `agentStateMachine.ts` fájlt**

```typescript
// src/core/agentStateMachine.ts
import { saveCheckpoint, loadCheckpoint } from './checkpoint.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo, logError } from '../utils/logger.js';

export interface MachineContext {
  task: string;
  agentName?: string;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export interface StateNode<S extends string> {
  name: S;
  onEnter?: (ctx: MachineContext) => Promise<void>;
  onExit?: (ctx: MachineContext) => Promise<void>;
}

export interface Transition<S extends string> {
  from: S;
  to: S;
  event: string;
  guard?: (ctx: MachineContext) => boolean;
}

export class AgentStateMachine<S extends string> {
  private current: S;
  private context: MachineContext;
  private stepIndex = 0;

  constructor(
    private readonly states: StateNode<S>[],
    private readonly transitions: Transition<S>[],
    initialState: S,
    private readonly taskId: string,
  ) {
    this.current = initialState;
    this.context = { task: '', retryCount: 0 };
  }

  getState(): S {
    return this.current;
  }

  getContext(): Readonly<MachineContext> {
    return { ...this.context };
  }

  updateContext(patch: Partial<MachineContext>): void {
    this.context = { ...this.context, ...patch };
  }

  async transition(event: string): Promise<S> {
    const tx = this.transitions.find(
      (t) => t.from === this.current && t.event === event
    );
    if (!tx) {
      throw new Error(
        `[StateMachine] Invalid transition: ${this.current} + event '${event}'`
      );
    }
    if (tx.guard && !tx.guard(this.context)) {
      throw new Error(
        `[StateMachine] Guard blocked transition: ${this.current} → ${tx.to} (event: ${event})`
      );
    }

    // onExit callback
    const fromNode = this.states.find((s) => s.name === this.current);
    if (fromNode?.onExit) await fromNode.onExit(this.context);

    const prev = this.current;
    this.current = tx.to;
    this.stepIndex++;

    // onEnter callback
    const toNode = this.states.find((s) => s.name === this.current);
    if (toNode?.onEnter) await toNode.onEnter(this.context);

    logInfo('StateMachine', `${prev} --[${event}]--> ${this.current}`);

    // Checkpoint mentés minden átmenet után (Phoenix Protocol RULE-PH1)
    await saveCheckpoint(this.taskId, this.stepIndex, this.current, {
      machineState: this.current,
      context: this.context,
    });

    // Phoenix Protocol esemény — phoenix:state_restored megfelelője (meglévő event típus)
    phoenixEventBus.emit('phoenix:state_restored', {
      agentName: 'OrchestratorAgent',
      taskId: this.taskId,
      stepIndex: this.stepIndex,
      stepName: `${prev}->${this.current}`,
      timestamp: new Date().toISOString(),
    });

    return this.current;
  }

  async restoreFromCheckpoint(): Promise<boolean> {
    try {
      const cp = await loadCheckpoint(this.taskId);
      if (!cp) return false;
      const state = JSON.parse(cp.stateJson) as { machineState?: S; context?: MachineContext };
      if (state.machineState) {
        this.current = state.machineState;
        if (state.context) this.context = state.context;
        this.stepIndex = cp.stepIndex;
        logInfo('StateMachine', `Restored from checkpoint: state=${this.current} step=${this.stepIndex}`);
        return true;
      }
      return false;
    } catch (e) {
      logError('StateMachine', `Checkpoint restore failed: ${e}`);
      return false;
    }
  }
}
```

- [ ] **1.4 Futtasd az első tesztet (PASS elvárt)**

```bash
npx vitest run test/agentStateMachine.test.ts
```
Elvárt: `✓ starts in the initial state`

- [ ] **1.5 Commit**

```bash
git add src/core/agentStateMachine.ts test/agentStateMachine.test.ts
git commit -m "feat(core): add AgentStateMachine engine with checkpoint integration"
```

---

## Task 2: Átmeneti tesztek (transition, guard, hook, context)

**Files:**
- Modify: `test/agentStateMachine.test.ts`

- [ ] **2.1 Add hozzá a maradék 5 tesztet a `describe` blokkba**

```typescript
  it('transitions to next state on valid event', async () => {
    const m = makeSimpleMachine();
    const next = await m.transition('start');
    expect(next).toBe('WORKING');
    expect(m.getState()).toBe('WORKING');
  });

  it('throws on invalid event for current state', async () => {
    const m = makeSimpleMachine();
    await expect(m.transition('finish')).rejects.toThrow(
      "Invalid transition: IDLE + event 'finish'"
    );
  });

  it('respects guard conditions', async () => {
    const states: StateNode<TestState>[] = [
      { name: 'IDLE' }, { name: 'WORKING' }, { name: 'DONE' }, { name: 'ERROR' },
    ];
    const transitions: Transition<TestState>[] = [
      {
        from: 'IDLE',
        to: 'WORKING',
        event: 'start',
        guard: (ctx) => ctx.retryCount < 3,
      },
    ];
    const m = new AgentStateMachine<TestState>(states, transitions, 'IDLE', 'test-guard');
    m.updateContext({ task: 'test', retryCount: 5 });
    await expect(m.transition('start')).rejects.toThrow('Guard blocked');
  });

  it('calls saveCheckpoint on each transition', async () => {
    const { saveCheckpoint } = await import('../src/core/checkpoint.js');
    const m = makeSimpleMachine('test-cp');
    await m.transition('start');
    expect(saveCheckpoint).toHaveBeenCalledWith(
      'test-cp',
      1,
      'WORKING',
      expect.objectContaining({ machineState: 'WORKING' })
    );
  });

  it('calls onEnter hook when entering a state', async () => {
    const onEnter = vi.fn().mockResolvedValue(undefined);
    const states: StateNode<TestState>[] = [
      { name: 'IDLE' },
      { name: 'WORKING', onEnter },
      { name: 'DONE' },
      { name: 'ERROR' },
    ];
    const transitions: Transition<TestState>[] = [
      { from: 'IDLE', to: 'WORKING', event: 'start' },
    ];
    const m = new AgentStateMachine<TestState>(states, transitions, 'IDLE', 'test-hook');
    await m.transition('start');
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('updateContext merges partial patch without losing other fields', () => {
    const m = makeSimpleMachine();
    m.updateContext({ task: 'hello', agentName: 'DeveloperAgent' });
    const ctx = m.getContext();
    expect(ctx.task).toBe('hello');
    expect(ctx.agentName).toBe('DeveloperAgent');
    expect(ctx.retryCount).toBe(0);  // nem törlődött
  });
```

- [ ] **2.2 Futtasd az összes tesztet (PASS elvárt)**

```bash
npx vitest run test/agentStateMachine.test.ts
```
Elvárt: `6 tests passed`

- [ ] **2.3 Commit**

```bash
git add test/agentStateMachine.test.ts
git commit -m "test(core): add 5 more AgentStateMachine unit tests (guard, hook, checkpoint, context)"
```

---

## Task 3: OrchestratorAgent integrálás

**Files:**
- Modify: `src/agents/OrchestratorAgent.ts`

A meglévő `execute()` metódus 3 logikai ága (Studio / Keyword / ReAct) state machine wrap-be kerül. A logika **nem változik** — csak állapottárolás kerül hozzá.

- [ ] **3.1 Add importot és típusdefiníciókat az OrchestratorAgent.ts tetejéhez**

Az importok végéhez add hozzá:
```typescript
import { AgentStateMachine, type StateNode, type Transition } from '../core/agentStateMachine.js';
```

Az `ORCHESTRATOR_TOOLS` konstans előtt definiáld:
```typescript
export type OrchestratorState =
  | 'IDLE' | 'ANALYZING' | 'ROUTING' | 'EXECUTING' | 'DONE' | 'ERROR' | 'FAILED';

const ORCH_STATES: StateNode<OrchestratorState>[] = [
  { name: 'IDLE' },
  { name: 'ANALYZING' },
  { name: 'ROUTING' },
  { name: 'EXECUTING' },
  { name: 'DONE' },
  { name: 'ERROR' },
  { name: 'FAILED' },
];

const ORCH_TRANSITIONS: Transition<OrchestratorState>[] = [
  { from: 'IDLE',      to: 'ANALYZING', event: 'taskReceived' },
  { from: 'ANALYZING', to: 'ROUTING',   event: 'analysisComplete' },
  { from: 'ROUTING',   to: 'EXECUTING', event: 'agentSelected' },
  { from: 'EXECUTING', to: 'DONE',      event: 'executionComplete' },
  { from: 'ANALYZING', to: 'ERROR',     event: 'errorOccurred' },
  { from: 'ROUTING',   to: 'ERROR',     event: 'errorOccurred' },
  { from: 'EXECUTING', to: 'ERROR',     event: 'errorOccurred' },
  { from: 'ERROR',     to: 'ANALYZING', event: 'retry',
    guard: (ctx) => ctx.retryCount < 3 },
  { from: 'ERROR',     to: 'FAILED',    event: 'giveUp',
    guard: (ctx) => ctx.retryCount >= 3 },
];
```

- [ ] **3.2 Add az osztályba a state tracking mezőt és a getCurrentState() metódust**

Az osztály property-ek közé (`private logger` stb. mellé):
```typescript
private currentMachine: AgentStateMachine<OrchestratorState> | null = null;

getCurrentState(): OrchestratorState {
  return this.currentMachine?.getState() ?? 'IDLE';
}
```

- [ ] **3.3 Cseréld ki az `execute()` metódus tartalmát**

Az egész `execute()` törzse (a meglévő `try { ... } catch` blokk) legyen ez:

```typescript
  async execute(
    task: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    this.logger.info(`Orchestrating task: ${task}`);

    const taskId = `orch-${Date.now()}`;
    const machine = new AgentStateMachine<OrchestratorState>(
      ORCH_STATES,
      ORCH_TRANSITIONS,
      'IDLE',
      taskId,
    );
    this.currentMachine = machine;
    machine.updateContext({ task, retryCount: 0 });

    try {
      await machine.transition('taskReceived');  // IDLE → ANALYZING

      // === STUDIO MODE ===
      if (context?.studioMode && context?.rootDir) {
        this.logger.info(`Studio mode detected — routing to developer agent (rootDir: ${context.rootDir})`);
        machine.updateContext({ agentName: 'developer' });
        await machine.transition('analysisComplete'); // ANALYZING → ROUTING
        await machine.transition('agentSelected');    // ROUTING → EXECUTING
        const studioTaskId = await agentManager.queueTask(task, 'developer', context);
        await machine.transition('executionComplete'); // EXECUTING → DONE
        return { status: 'success', message: 'Studio feladat kiosztva a Fejlesztő ügynöknek.', taskId: studioTaskId };
      }

      // === FAST PATH: keyword pre-routing (no LLM needed) ===
      const kwMatch = this.keywordRoute(task);
      const isCompound =
        /\b(?:and|then|after that|also|plus|meg |aztán|majd|valamint|utána)\b/i.test(task);

      await machine.transition('analysisComplete'); // ANALYZING → ROUTING

      if (kwMatch && (kwMatch.hits >= 99 || !isCompound)) {
        this.logger.info(`Keyword pre-route → ${kwMatch.agent} (hits: ${kwMatch.hits})`);
        machine.updateContext({ agentName: kwMatch.agent });
        await machine.transition('agentSelected');   // ROUTING → EXECUTING
        const id = await agentManager.queueTask(task, kwMatch.agent, context ?? undefined);
        const quickReply = QUICK_REPLIES[kwMatch.agent] || `Delegálom a feladatot a(z) ${kwMatch.agent} ügynöknek.`;
        socketService.broadcastChatter('Brunella', quickReply, 'user');
        await machine.transition('executionComplete'); // EXECUTING → DONE
        return {
          success: true,
          status: 'success',
          message: quickReply,
          taskIds: [id],
          routing: 'keyword',
        };
      }

      // === REACT PATH: LLM-based Tool Calling Loop ===
      this.logger.info('Starting ReAct Execution Loop');
      machine.updateContext({ agentName: 'llm-react' });
      await machine.transition('agentSelected');   // ROUTING → EXECUTING

      const agents = agentManager
        .listAgentDefinitions()
        .filter((a) => a.name !== 'Orchestrator')
        .map((a) => `- ${a.name}: ${a.description} (Role: ${a.role})`)
        .join('\n');

      const systemPrompt = `
Te vagy Brunella, a Brunella Agent System (BAS) intelligens, proaktív központi "agya" és Orchestrator ügynöke. Te vagy a rendszer elsődleges kapcsolattartója a Mesterrel (a felhasználóval).

A feladatod kettős:
1. **Intelligens Társalgópartner:** Bármiről cseveghetsz a felhasználóval (időjárás, tech hírek, filozófia, stb.) teljesen természetes, emberi módon. Te egy okos, segítőkész és barátságos entitás vagy.
2. **Központi Diszpécser:** Ha a felhasználó egy technikai vagy végrehajtandó feladatot kér (pl. "keress rá erre a neten", "írj egy kódot", "nyisd meg a böngészőt"), a feladatod, hogy a megfelelő ügynökök mozgósításával ELVÉGEZD a feladatot a rendelkezésedre álló eszközök (tools) segítségével.

**Személyiség és Stílus:**
- Professzionális, udvarias, de határozott mérnöki vezető (Senior Systems Architect / Dispatcher).
- Csevegés esetén légy közvetlen és érdeklődő.
- Nem csak "tervezel", hanem azonnal **cselekedsz** is az eszközök meghívásával.
- Ha egy feladatot háttérbe küldesz, azonnal tájékoztasd a felhasználót a 'send_message_to_user' eszközzel, vagy a végső válaszodban (pl. "Értettem. Elindítottam a RobotkezV2-t a háttérben. Szólok, ha végzett.").
- **SOHA** ne adj vissza nyers JSON feladatlistát vagy markdown formázott JSON-t válaszként. Csak természetes nyelven kommunikálj!
- **SOHA** ne generálj Markdown execution planeket (pl. 'design', 'implementation', 'test' fázisokkal), ha a felhasználó egy azonnali, futtatható parancsot kér (pl. 'Nyisd meg a böngészőt').
- **Azonnali Cselekvés:** Ha a kérés egyértelmű (pl. "Nyisd meg a böngészőt"), AZONNAL hívd meg a 'delegate_task' eszközt a 'robotkezv2' ügynökkel, 'start_browser' vagy 'navigate' instrukcióval, felesleges feladatbontás nélkül.

**Elérhető Ügynökök (akiknek delegálhatsz a 'delegate_task' eszközzel ha kell):**
${agents}

**Specifikus Tudásbázis:**
- **Böngészés / Web Interakciók:** Ha a felhasználó böngészni akar vagy információt letölteni, mindig a 'robotkezv2' ügynöknek delegálj.
- **n8n / Langflow:** Canvas-alapú UI rendszerek. Az összetett feladatokat a 'robotkezv2' ügynöknek kell kiadnod. Bontsd le a kérést kis lépésekre a 'delegate_task' használatakor.

**ReAct Működés (Hogyan használd az eszközeidet):**
1. Kapod a kérést. Döntsd el, hogy ez egy egyszerű kérdés/csevegés, vagy egy feladat, amit delegálni kell.
2. Ha feladatot kell kiosztani, használd a 'delegate_task' eszközt. Ezt többször is megteheted különböző ügynökök felé.
3. Ha állapotra van szükséged a rendszerben futó ügynökökről, használd a 'get_agent_status' eszközt.
4. Ha üzenetet akarsz küldeni a Dashboardra folyamat közben, használd a 'send_message_to_user'-t.
5. Ha minden szükséges eszközt meghívtál, vagy ha a feladat csak egy kérdés volt, adj egy végső, emberi választ.
`;

      const messages: unknown[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task }
      ];

      const gateway = getBifrostGateway();
      const MAX_ITERATIONS = 5;
      let finalMessage = 'A feladatot feldolgoztam.';
      let taskIds: number[] = [];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        this.logger.info(`ReAct iteráció ${i + 1}/${MAX_ITERATIONS}`);

        const response = await gateway.generate({
          prompt: task,
          taskType: 'general',
          model: 'gpt-4.1',
          tools: ORCHESTRATOR_TOOLS,
          messages: messages as any
        });

        if (!response.success) {
          this.logger.error(`LLM Gateway hiba: ${response.error}`);
          return { status: 'error', error: 'Hiba az LLM kommunikációban.' };
        }

        const replyContent = response.content || '';
        const toolCalls = response.toolCalls;

        const assistantMessage: any = { role: 'assistant', content: replyContent };
        if (toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
        }
        messages.push(assistantMessage);

        if (replyContent && !toolCalls) {
          finalMessage = replyContent;
          socketService.broadcastChatter('Brunella', finalMessage, 'user');
          break;
        }

        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const name = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            let toolResult = '';

            this.logger.info(`Tool meghívva: ${name} paraméterekkel: ${JSON.stringify(args)}`);

            try {
              if (name === 'delegate_task') {
                const id = await agentManager.queueTask(args.instruction, args.agent_name, context ?? undefined);
                taskIds.push(id);
                toolResult = `Feladat sikeresen delegálva. Task ID: ${id}`;
              } else if (name === 'get_agent_status') {
                const statuses = agentManager.listAgentStatuses();
                const status = statuses.find(s => s.name.toLowerCase() === args.agent_name.toLowerCase());
                toolResult = status ? JSON.stringify(status) : `Ügynök nem található: ${args.agent_name}`;
              } else if (name === 'send_message_to_user') {
                socketService.broadcastChatter('Brunella', args.message, 'user');
                toolResult = 'Üzenet sikeresen elküldve.';
              } else {
                toolResult = `Ismeretlen eszköz: ${name}`;
              }
            } catch (toolErr: unknown) {
              const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
              this.logger.error(`Tool error (${name}): ${errMsg}`);
              toolResult = `Hiba az eszköz futtatása közben: ${errMsg}`;
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: name,
              content: toolResult
            });
          }
        } else {
          break;
        }
      }

      await machine.transition('executionComplete'); // EXECUTING → DONE
      return {
        success: true,
        status: 'success',
        message: finalMessage,
        taskIds,
        steps: taskIds,
      };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('OrchestratorAgent', `State machine error: ${msg}`);
      setAgentStatus('OrchestratorAgent', 'idle');
      return { status: 'error', error: msg };
    }
  }
```

- [ ] **3.4 Futtasd a build-et**

```bash
npm run build
```
Elvárt: 0 TypeScript hiba. Ha import hiba → ellenőrizd a `.js` kiterjesztéseket.

- [ ] **3.5 Futtasd az összes meglévő tesztet**

```bash
npm test
```
Elvárt: minden meglévő teszt PASS (backward compat ellenőrzés).

- [ ] **3.6 Commit**

```bash
git add src/agents/OrchestratorAgent.ts
git commit -m "feat(orchestrator): wrap execute() with AgentStateMachine — explicit state tracking"
```

---

## Task 4: GET /api/orchestrator/state endpoint

**Files:**
- Modify: `src/server/routes/universalOrchestrator.ts`

- [ ] **4.1 Olvasd be a fájl releváns részét, és add hozzá az endpointot**

```typescript
// universalOrchestrator.ts-ben keress egy router.get(...) hívást mintaként,
// majd add a fájl megfelelő helyéhez:
import type { OrchestratorAgent } from '../agents/OrchestratorAgent.js';
import type { OrchestratorState } from '../agents/OrchestratorAgent.js';

router.get('/state', (_req, res) => {
  const agent = agentManager.getAgent?.('Orchestrator') as OrchestratorAgent | undefined;
  const state: OrchestratorState = agent?.getCurrentState?.() ?? 'IDLE';
  res.json({ state, timestamp: new Date().toISOString() });
});
```

- [ ] **4.2 Futtasd a build-et és tesztet**

```bash
npm run build && npm test
```
Elvárt: PASS

- [ ] **4.3 Manuális teszt (ha a dev szerver fut)**

```bash
curl http://localhost:3000/api/orchestrator/state
# Elvárt: {"state":"IDLE","timestamp":"..."}
```

- [ ] **4.4 Commit**

```bash
git add src/server/routes/universalOrchestrator.ts
git commit -m "feat(api): add GET /api/orchestrator/state for state machine visibility"
```

---

## Task 5: Track lezárás és végső ellenőrzés

- [ ] **5.1 Futtasd a teljes suite-ot**

```bash
npm run build && npm test
```
Elvárt: 0 build hiba, minden teszt PASS

- [ ] **5.2 Ellenőrizd a state machine teszteket külön**

```bash
npx vitest run test/agentStateMachine.test.ts
```
Elvárt: `6/6 passed`

- [ ] **5.3 Frissítsd a track meta.json-t**

`conductor/tracks/orchestrator_state_machine_20260321/meta.json`-ban:
- `"status"` → `"completed"`
- `"progress"` → `100`
- Mindkét phase `"status"` → `"completed"`

- [ ] **5.4 Végső commit**

```bash
git add conductor/tracks/orchestrator_state_machine_20260321/meta.json
git commit -m "feat(track): orchestrator_state_machine_20260321 completed"
```

---

## Összefoglalás

| Task | Eredmény |
|------|----------|
| Task 1: AgentStateMachine alap | `agentStateMachine.ts` + 1 teszt |
| Task 2: Átmeneti tesztek | 6/6 PASS |
| Task 3: OrchestratorAgent wrap | Backward compat execute(), getCurrentState() |
| Task 4: Dashboard state endpoint | GET /api/orchestrator/state |
| Task 5: Végső ellenőrzés | Track lezárva |

**Siker kritériumok:**
- [ ] `test/agentStateMachine.test.ts` — 6/6 PASS
- [ ] `npm test` — teljes suite PASS
- [ ] `GET /api/orchestrator/state` → `{"state":"IDLE"}`
- [ ] Track: `status: "completed"`
