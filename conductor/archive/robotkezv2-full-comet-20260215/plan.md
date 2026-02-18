# RobotkezV2 - Full Comet Implementation Plan

**Track ID:** `robotkezv2-full-comet-20260215`
**Estimated Duration:** 40 hours (5 working days)
**Target Completion:** 2026-02-22

---

## Phase Breakdown

| **Phase** | **Duration** | **Deliverables** | **Tests Required** |
|-----------|--------------|------------------|-------------------|
| 0. Pre-Implementation | 1h | Track setup, dependency audit | ✅ Build passes |
| 1. Jules Integration | 6h | Persistent Browser Tools integrated | ✅ pb_* tools work |
| 2. Core Agent | 8h | RobotkezV2Agent implementation | ✅ Unit tests 90%+ |
| 3. LLM Planning | 6h | Plan generator + validation | ✅ Mock LLM tests |
| 4. Background Tasks | 6h | Task manager + checkpoint | ✅ Parallel execution |
| 5. REST API | 4h | Express routes | ✅ Postman tests |
| 6. Dashboard UI | 8h | Comet-style React component | ✅ Manual UI test |
| 7. CLI Commands | 4h | Commander.js integration | ✅ CLI smoke tests |
| 8. Integration Testing | 4h | E2E workflows | ✅ 10+ scenarios pass |
| 9. Documentation | 2h | User docs (magyar) | ✅ README updated |
| 10. Final Polish | 1h | Bug fixes, performance tuning | ✅ All tests green |

---

## Phase 0: Pre-Implementation (1h)

### ✅ Checklist

- [x] Track mappa létrehozása (`conductor/tracks/robotkezv2-full-comet-20260215/`)
- [x] `meta.json` elkészítése
- [x] `spec.md` elkészítése
- [x] `plan.md` elkészítése
- [ ] `checklist.md` elkészítése
- [ ] `diary.md` inicializálása
- [ ] `conductor/tracks.md` frissítése (track hozzáadása Active-hez)
- [ ] Dependency audit futtatása
- [ ] **Checkpoint: `npm run build` ✅**

### Commands

```bash
cd conductor/tracks/robotkezv2-full-comet-20260215
touch checklist.md diary.md

# Dependency check
cd ../../../
npm run build
npm test
```

---

## Phase 1: Jules Persistent Browser Integration (6h)

### Goal
Jules `interactive_browser.py` + TypeScript bridge áthozása és tesztelése.

### Tasks

#### 1.1 Python Controller Migration (2h)

**Fájlok:**
- `myai/interactive_browser.py` (áthozva `robotkezv2/jules_session/`)
- Frissítés: 3 új action támogatás (scroll, wait, extract)

**Módosítások:**

```python
# myai/interactive_browser.py

# ÚJ ACTION: scroll
elif action == "scroll":
    direction = cmd.get("direction", "down")
    amount = cmd.get("amount", 100)
    if direction == "down":
        await pg.evaluate(f"window.scrollBy(0, {amount})")
    elif direction == "up":
        await pg.evaluate(f"window.scrollBy(0, -{amount})")
    # ... stb.
    result = {"status": "success", "message": f"Scrolled {direction}"}

# ÚJ ACTION: wait
elif action == "wait":
    selector = cmd.get("selector")
    timeout = cmd.get("timeout", 5000)
    try:
        await pg.wait_for_selector(selector, timeout=timeout)
        result = {"status": "success"}
    except TimeoutError:
        result = {"status": "error", "message": f"Timeout waiting for {selector}"}

# ÚJ ACTION: extract
elif action == "extract":
    selector = cmd.get("selector")
    extract_type = cmd.get("type", "text")

    if extract_type == "text":
        elements = await pg.query_selector_all(selector)
        data = [await el.inner_text() for el in elements]
    elif extract_type == "attribute":
        attr = cmd.get("attribute")
        elements = await pg.query_selector_all(selector)
        data = [await el.get_attribute(attr) for el in elements]

    result = {"status": "success", "data": data}
```

**Tests:**

```bash
# Manuális teszt
cd myai
python interactive_browser.py
# stdin: {"action": "launch", "headless": false}
# stdin: {"action": "navigate", "url": "https://google.com"}
# stdin: {"action": "scroll", "direction": "down", "amount": 200}
# Ctrl+C
```

#### 1.2 TypeScript Bridge Update (2h)

**Fájl:** `src/utils/persistentBrowser.ts`

**Kiegészítés:**

```typescript
export interface BrowserCommand {
    action: 'launch' | 'navigate' | 'click' | 'type' | 'screenshot' | 'content' | 'scroll' | 'wait' | 'extract' | 'close';
    url?: string;
    selector?: string;
    text?: string;
    headless?: boolean;
    // ÚJ paraméterek:
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
    timeout?: number;
    type?: 'text' | 'attribute' | 'html';
    attribute?: string;
}

export interface BrowserResponse {
    status: 'success' | 'error';
    message?: string;
    url?: string;
    screenshot?: string;
    content?: string;
    data?: any; // ÚJ: extract results
}
```

#### 1.3 MCP Tools Registration (2h)

**Fájl:** `src/tools/persistentBrowserTools.ts` (áthozva + kibővítve)

**Új tools:**

```typescript
server.tool("pb_scroll", "Scroll the page", {
    direction: z.enum(['up', 'down', 'left', 'right']),
    amount: z.number().optional().default(100)
}, async ({ direction, amount }) => {
    const res = await persistentBrowser.sendCommand({ action: 'scroll', direction, amount });
    return { content: [{ type: "text", text: res.message || `Scrolled ${direction}` }] };
});

server.tool("pb_wait", "Wait for element", {
    selector: z.string(),
    timeout: z.number().optional().default(5000)
}, async ({ selector, timeout }) => {
    const res = await persistentBrowser.sendCommand({ action: 'wait', selector, timeout });
    if (res.status === 'error') {
        return { isError: true, content: [{ type: "text", text: res.message }] };
    }
    return { content: [{ type: "text", text: `Element ready: ${selector}` }] };
});

server.tool("pb_extract", "Extract data from page", {
    selector: z.string(),
    type: z.enum(['text', 'attribute', 'html']),
    attribute: z.string().optional()
}, async ({ selector, type, attribute }) => {
    const res = await persistentBrowser.sendCommand({
        action: 'extract',
        selector,
        type,
        attribute
    });
    return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
});
```

**Registry Update:** `src/server/registry.ts`

```typescript
import { registerPersistentBrowserTools } from '../tools/persistentBrowserTools.js';

// In registerAllTools():
registerPersistentBrowserTools(server);
```

#### 1.4 Tests

```typescript
// test/persistentBrowser.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { persistentBrowser } from '../src/utils/persistentBrowser.js';

describe('Persistent Browser', () => {
    beforeAll(async () => {
        await persistentBrowser.sendCommand({ action: 'launch', headless: true });
    });

    afterAll(async () => {
        await persistentBrowser.close();
    });

    it('should navigate to URL', async () => {
        const res = await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });
        expect(res.status).toBe('success');
        expect(res.url).toContain('example.com');
    });

    it('should scroll page', async () => {
        const res = await persistentBrowser.sendCommand({
            action: 'scroll',
            direction: 'down',
            amount: 200
        });
        expect(res.status).toBe('success');
    });

    it('should extract text', async () => {
        const res = await persistentBrowser.sendCommand({
            action: 'extract',
            selector: 'h1',
            type: 'text'
        });
        expect(res.status).toBe('success');
        expect(res.data).toBeInstanceOf(Array);
    });
});
```

**Checkpoint:** `npm run build && npm test` ✅

---

## Phase 2: Core RobotkezV2Agent (8h)

### Goal
Agent implementáció magyar intent parsing + multi-step execution.

### Tasks

#### 2.1 Agent Class (4h)

**Fájl:** `src/agents/RobotkezV2Agent.ts`

**Implementation:**

```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { persistentBrowser } from '../utils/persistentBrowser.js';

export class RobotkezV2Agent extends BaseAgent {
    name = 'RobotkezV2';
    role = 'Magyar Agentic Browser';
    description = 'Perplexity Comet-szerű intelligens böngésző ügynök magyar nyelven';
    capabilities = [
        'agentic_browsing',
        'multi_step_automation',
        'context_awareness',
        'magyar_nyelv',
        'tool_orchestration'
    ];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const instruction = context.task || '';
        setAgentStatus(this.name, 'working', instruction.slice(0, 50));

        try {
            logInfo(this.name, `Utasítás: ${instruction}`);

            // 1. Intent parsing (egyszerű verzió Phase 2-ben, LLM Phase 3-ban)
            const intent = this.parseHungarianIntent(instruction);

            // 2. Simple plan execution (hardcoded patterns)
            const result = await this.executeSimplePlan(intent);

            // 3. Screenshot
            await persistentBrowser.sendCommand({ action: 'screenshot' }).catch(() => {});

            return {
                success: true,
                message: result.message,
                data: result.data,
                thoughts: `Intent: ${intent.type}`
            };

        } catch (error: any) {
            logError(this.name, `Hiba: ${error.message}`);
            return {
                success: false,
                message: `Nem sikerült: ${error.message}`
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    /**
     * Simple intent parsing (regex-based, Phase 2 MVP)
     * Phase 3-ban LLM-re cseréljük
     */
    private parseHungarianIntent(instruction: string): Intent {
        const lower = instruction.toLowerCase();

        // Navigáció pattern
        if (lower.match(/navigálj|menj|nyisd meg|látogasd meg/)) {
            const urlMatch = instruction.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                return { type: 'navigate', url: urlMatch[1] };
            }

            // Google search fallback
            const searchQuery = instruction.replace(/navigálj|menj|nyisd meg|látogasd meg|keress rá/gi, '').trim();
            return {
                type: 'search',
                query: searchQuery,
                url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
            };
        }

        // Kattintás pattern
        if (lower.match(/kattints|klikk|nyomd meg/)) {
            const selectorMatch = instruction.match(/['"](.*?)['"]/);
            const selector = selectorMatch ? selectorMatch[1] : '.primary-button';
            return { type: 'click', selector };
        }

        // Gépelés pattern
        if (lower.match(/írj|gépelj|tölts ki/)) {
            const textMatch = instruction.match(/['"](.*?)['"]/);
            const text = textMatch ? textMatch[1] : '';
            return { type: 'type', text, selector: 'input' };
        }

        // Screenshot
        if (lower.match(/készíts képet|screenshot/)) {
            return { type: 'screenshot' };
        }

        // Default: Google search
        return {
            type: 'search',
            query: instruction,
            url: `https://www.google.com/search?q=${encodeURIComponent(instruction)}`
        };
    }

    /**
     * Execute simple intent (Phase 2 MVP)
     * Phase 3-ban multi-step LLM plan execution
     */
    private async executeSimplePlan(intent: Intent): Promise<{ message: string; data: any }> {
        switch (intent.type) {
            case 'navigate':
            case 'search':
                const navRes = await persistentBrowser.sendCommand({
                    action: 'navigate',
                    url: intent.url!
                });
                return {
                    message: `Navigáltam ide: ${navRes.url || intent.url}`,
                    data: { url: navRes.url }
                };

            case 'click':
                await persistentBrowser.sendCommand({
                    action: 'click',
                    selector: intent.selector!
                });
                return {
                    message: `Kattintottam: ${intent.selector}`,
                    data: { selector: intent.selector }
                };

            case 'type':
                await persistentBrowser.sendCommand({
                    action: 'type',
                    selector: intent.selector!,
                    text: intent.text!
                });
                return {
                    message: `Begépeltem: "${intent.text}"`,
                    data: { text: intent.text }
                };

            case 'screenshot':
                await persistentBrowser.sendCommand({ action: 'screenshot' });
                return {
                    message: 'Képernyőkép készítve',
                    data: { screenshot: true }
                };

            default:
                throw new Error(`Ismeretlen intent: ${intent.type}`);
        }
    }
}

interface Intent {
    type: 'navigate' | 'search' | 'click' | 'type' | 'screenshot';
    url?: string;
    query?: string;
    selector?: string;
    text?: string;
}

export default RobotkezV2Agent;
```

#### 2.2 Agent Registration (1h)

**Fájl:** `src/agents/registry.json`

```json
{
  "name": "robotkezv2",
  "title": "RobotkezV2 Agent",
  "description": "Magyar nyelvű agentic browser (Comet-style)",
  "class": "RobotkezV2Agent",
  "module": "./agents/RobotkezV2Agent.js",
  "capabilities": [
    "agentic_browsing",
    "multi_step_automation",
    "context_awareness",
    "magyar_nyelv",
    "tool_orchestration"
  ],
  "triggers": [
    "robotkéz",
    "böngésző",
    "navigálj",
    "keress rá",
    "kattints",
    "tölts ki",
    "rendelj",
    "keresd meg"
  ],
  "category": "automation",
  "status": "active",
  "priority": 1
}
```

**Fájl:** `src/server/registry.ts` - Import hozzáadása

```typescript
import { RobotkezV2Agent } from '../agents/RobotkezV2Agent.js';

// In registerAgents():
agentManager.registerAgent(new RobotkezV2Agent());
```

#### 2.3 Unit Tests (3h)

**Fájl:** `test/robotkezV2Agent.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { RobotkezV2Agent } from '../src/agents/RobotkezV2Agent.js';

describe('RobotkezV2Agent', () => {
    const agent = new RobotkezV2Agent();

    describe('Intent Parsing', () => {
        it('should parse navigate intent', () => {
            const intent = (agent as any).parseHungarianIntent('navigálj a https://google.com-ra');
            expect(intent.type).toBe('navigate');
            expect(intent.url).toBe('https://google.com');
        });

        it('should parse search intent', () => {
            const intent = (agent as any).parseHungarianIntent('keress rá az AI hírekre');
            expect(intent.type).toBe('search');
            expect(intent.query).toBe('AI hírekre');
            expect(intent.url).toContain('google.com/search');
        });

        it('should parse click intent', () => {
            const intent = (agent as any).parseHungarianIntent('kattints a ".button" elemre');
            expect(intent.type).toBe('click');
            expect(intent.selector).toBe('.button');
        });

        it('should parse type intent', () => {
            const intent = (agent as any).parseHungarianIntent('gépelj be "Hello World"');
            expect(intent.type).toBe('type');
            expect(intent.text).toBe('Hello World');
        });

        it('should default to search', () => {
            const intent = (agent as any).parseHungarianIntent('valami random szöveg');
            expect(intent.type).toBe('search');
            expect(intent.query).toBe('valami random szöveg');
        });
    });

    describe('executeTask', () => {
        it('should execute navigation task', async () => {
            // Mock persistentBrowser
            jest.mock('../src/utils/persistentBrowser', () => ({
                persistentBrowser: {
                    sendCommand: jest.fn().mockResolvedValue({
                        status: 'success',
                        url: 'https://google.com'
                    })
                }
            }));

            const result = await agent.executeTask({ task: 'navigálj a https://google.com-ra' });
            expect(result.success).toBe(true);
            expect(result.message).toContain('Navigáltam');
        });
    });
});
```

**Checkpoint:** `npm run build && npm test` ✅ (95%+ coverage)

---

## Phase 3: LLM Planning (6h)

### Goal
LLM-based execution plan generation (Ollama/Gemini integration).

### Tasks

#### 3.1 LLM Client Wrapper (2h)

**Fájl:** `src/utils/llmPlanner.ts` (ÚJ)

```typescript
import { callLLM } from '../core/llm_client.js';

export interface ExecutionPlan {
    plan: ExecutionStep[];
    estimatedDuration: number;
    requiresUserInput?: string[];
    backgroundEligible: boolean;
    contextNeeded?: string[];
}

export interface ExecutionStep {
    action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract';
    selector?: string;
    url?: string;
    text?: string;
    timeout?: number;
    description: string; // Magyar nyelvű leírás
}

const SYSTEM_PROMPT = `
Te egy intelligens böngésző ügynök vagy, hasonló a Perplexity Comet-hez.
A felhasználó magyar nyelvű utasítást ad, te pedig részletes lépésekre bontod.

ELÉRHETŐ MŰVELETEK:
- navigate(url): Navigálás URL-re
- click(selector): Kattintás CSS selector alapján
- type(selector, text): Szöveg gépelés input mezőbe
- scroll(direction, amount): Görgetés
- wait(selector, timeout): Várakozás elem megjelenésére
- screenshot(): Képernyőkép készítés
- extract(selector, type): Adat kinyerés

SZABÁLYOK:
1. Minden lépésnek legyen magyar description
2. Használj wait()-et oldal betöltés után
3. Estimated duration legyen reális (ms-ben)
4. Ha user input kell, add hozzá a requiresUserInput array-hez

VÁLASZ FORMÁTUM (JSON):
{
  "plan": [ { "action": "...", "description": "...", ...params... } ],
  "estimatedDuration": 30000,
  "requiresUserInput": [],
  "backgroundEligible": false,
  "contextNeeded": []
}
`;

export async function generateExecutionPlan(instruction: string): Promise<ExecutionPlan> {
    const userPrompt = `Utasítás: ${instruction}`;

    const response = await callLLM(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.3,
        maxTokens: 2048
    });

    // Parse JSON response
    const cleaned = response.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleaned) as ExecutionPlan;

    // Validation
    if (!plan.plan || !Array.isArray(plan.plan)) {
        throw new Error('Invalid plan structure from LLM');
    }

    return plan;
}
```

#### 3.2 Agent Update (2h)

**Fájl:** `src/agents/RobotkezV2Agent.ts` - Frissítés

```typescript
import { generateExecutionPlan, ExecutionPlan, ExecutionStep } from '../utils/llmPlanner.js';

export class RobotkezV2Agent extends BaseAgent {
    // ...

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const instruction = context.task || '';
        setAgentStatus(this.name, 'working', instruction.slice(0, 50));

        try {
            // LLM-based planning (Phase 3)
            const plan = await generateExecutionPlan(instruction);

            logInfo(this.name, `Plan generated: ${plan.plan.length} steps, ${plan.estimatedDuration}ms`);

            // Execute multi-step plan
            const steps: ExecutionStep[] = [];
            for (let i = 0; i < plan.plan.length; i++) {
                const step = plan.plan[i];
                logInfo(this.name, `Step ${i + 1}/${plan.plan.length}: ${step.description}`);

                try {
                    await this.executeStep(step);
                    steps.push({ ...step, status: 'completed' } as any);
                } catch (error: any) {
                    steps.push({ ...step, status: 'error', error: error.message } as any);
                    throw error;
                }
            }

            // Final screenshot
            await persistentBrowser.sendCommand({ action: 'screenshot' }).catch(() => {});

            return {
                success: true,
                message: `Végrehajtva: ${plan.plan.length} lépés`,
                data: {
                    plan: plan.plan,
                    steps,
                    duration: plan.estimatedDuration
                },
                thoughts: `LLM-generated plan executed successfully`
            };

        } catch (error: any) {
            logError(this.name, `Hiba: ${error.message}`);
            return {
                success: false,
                message: `Nem sikerült: ${error.message}`
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    /**
     * Execute single step
     */
    private async executeStep(step: ExecutionStep): Promise<void> {
        switch (step.action) {
            case 'navigate':
                await persistentBrowser.sendCommand({ action: 'navigate', url: step.url! });
                break;

            case 'click':
                await persistentBrowser.sendCommand({ action: 'click', selector: step.selector! });
                break;

            case 'type':
                await persistentBrowser.sendCommand({
                    action: 'type',
                    selector: step.selector!,
                    text: step.text!
                });
                break;

            case 'scroll':
                await persistentBrowser.sendCommand({
                    action: 'scroll',
                    direction: (step as any).direction || 'down',
                    amount: (step as any).amount || 100
                });
                break;

            case 'wait':
                await persistentBrowser.sendCommand({
                    action: 'wait',
                    selector: step.selector!,
                    timeout: step.timeout || 5000
                });
                break;

            case 'screenshot':
                await persistentBrowser.sendCommand({ action: 'screenshot' });
                break;

            case 'extract':
                const res = await persistentBrowser.sendCommand({
                    action: 'extract',
                    selector: step.selector!,
                    type: (step as any).type || 'text'
                });
                // Store extracted data in step metadata
                (step as any).extractedData = res.data;
                break;

            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }
}
```

#### 3.3 LLM Mock Tests (2h)

```typescript
// test/llmPlanner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateExecutionPlan } from '../src/utils/llmPlanner.js';
import * as llmClient from '../src/core/llm_client.js';

vi.mock('../src/core/llm_client');

describe('LLM Planner', () => {
    it('should generate valid plan', async () => {
        vi.spyOn(llmClient, 'callLLM').mockResolvedValue(JSON.stringify({
            plan: [
                { action: 'navigate', url: 'https://google.com', description: 'Google megnyitása' },
                { action: 'wait', selector: 'input[name="q"]', timeout: 3000, description: 'Keresőmező betöltésre vár' }
            ],
            estimatedDuration: 10000,
            requiresUserInput: [],
            backgroundEligible: false
        }));

        const plan = await generateExecutionPlan('Keress rá az AI hírekre');

        expect(plan.plan).toHaveLength(2);
        expect(plan.plan[0].action).toBe('navigate');
        expect(plan.estimatedDuration).toBe(10000);
    });

    it('should throw on invalid LLM response', async () => {
        vi.spyOn(llmClient, 'callLLM').mockResolvedValue('invalid json');

        await expect(generateExecutionPlan('test')).rejects.toThrow();
    });
});
```

**Checkpoint:** `npm run build && npm test` ✅

---

## Phase 4: Background Task Manager (6h)

**Részletes implementáció a spec.md Section 3.4 alapján...**

_(Folytatás a következő üzenetben a teljes plan.md-vel)_

---

**Status:** Phase 0-3 tervek kész, Phase 4-10 következik...
