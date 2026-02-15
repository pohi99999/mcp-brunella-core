# RobotkezV2 - Full Comet Technical Specification

**Track ID:** `robotkezv2-full-comet-20260215`
**Status:** Active
**Version:** 1.0
**Last Updated:** 2026-02-15
**Author:** Claude Code + Pohánka Péter

---

## 1. Executive Summary

**RobotkezV2** egy Perplexity Comet-szerű **agentic browser** magyar nyelven. Természetes nyelvű utasításokat értelmez LLM segítségével, komplex multi-step workflow-kat hajt végre böngészőben, és képes background task-ok kezelésére.

**Inspiráció:** [Perplexity Comet](https://www.perplexity.ai/comet) - az első igazán agentic böngésző.

**Kulcs képességek:**
- ✅ **Magyar természetes nyelvű chat interface**
- ✅ **LLM-based execution plan generation** (Ollama/Gemini)
- ✅ **Multi-step browser automation** (komplex workflow-k)
- ✅ **Background task support** (hosszú műveletek párhuzamosan)
- ✅ **Context-aware operation** (több tab, form, adatbázis kezelés)
- ✅ **Dashboard + CLI interface** (EPP v2 compliance)
- ✅ **Live Browser View** (real-time screenshot)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                             │
├──────────────────────────────────────────────────────────────────┤
│  Dashboard (Comet-style UI)         CLI (brunella robotkez)     │
│  - Chat input                        - chat <instruction>        │
│  - Execution timeline                - exec <action>             │
│  - Live Browser View                 - status                    │
│  - Background tasks panel            - interactive (REPL)        │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                   REST API LAYER                                 │
├──────────────────────────────────────────────────────────────────┤
│  /api/v1/robotkez/chat       - Natural language execution       │
│  /api/v1/robotkez/plan       - Get execution plan               │
│  /api/v1/robotkez/exec       - Direct browser action            │
│  /api/v1/robotkez/status     - Browser + task status            │
│  /api/v1/robotkez/tasks      - Background task management       │
│  /api/browser/snapshot       - Live screenshot (existing)       │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                 ROBOTKEZV2 AGENT (Core Logic)                    │
├──────────────────────────────────────────────────────────────────┤
│  1. Intent Parser (Magyar NLP + LLM)                             │
│  2. Plan Generator (LLM-based multi-step planning)               │
│  3. Execution Orchestrator (Step-by-step automation)             │
│  4. Context Manager (Tab state, form data, history)              │
│  5. Background Task Manager (Long-running operations)            │
│  6. Error Recovery (Phoenix Protocol integration)                │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│              PERSISTENT BROWSER TOOLS (MCP Layer)                │
├──────────────────────────────────────────────────────────────────┤
│  pb_launch       - Browser indítás (headless/headed)             │
│  pb_navigate     - URL navigáció + wait for load                │
│  pb_click        - Element kattintás (CSS selector)              │
│  pb_type         - Szöveg gépelés input field-be                │
│  pb_screenshot   - Képernyőkép (Live View frissítés)             │
│  pb_content      - HTML tartalom lekérés (scraping)              │
│  pb_scroll       - Scroll műveletek (NEW)                        │
│  pb_extract      - Data extraction (structured) (NEW)            │
│  pb_wait         - Wait for element/timeout (NEW)                │
│  pb_close        - Browser bezárás + cleanup                     │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│          PERSISTENT BROWSER CONTROLLER (Python + Playwright)     │
├──────────────────────────────────────────────────────────────────┤
│  myai/interactive_browser.py (Jules infrastruktúra)              │
│  - Playwright async browser control                              │
│  - Stdin/stdout JSON protocol                                    │
│  - Persistent session (single long-lived process)                │
│  - Screenshot buffering + optimization                           │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Példa: "Rendelj pizzát a pizzahut.hu-ról"**

```
1. User input (Dashboard chat vagy CLI)
   → "Rendelj pizzát a pizzahut.hu-ról"

2. REST API (/api/v1/robotkez/chat)
   → POST { instruction: "Rendelj pizzát..." }

3. RobotkezV2Agent.executeTask()
   → Magyar intent parsing (regex + keyword)
   → Detect: "food ordering workflow"

4. Plan Generator (LLM call - Ollama/Gemini)
   System Prompt:
   "Te egy intelligens böngésző ügynök vagy.
    Utasítás: Rendelj pizzát a pizzahut.hu-ról
    Készíts részletes execution plan-t JSON formátumban."

   LLM Response:
   {
     "plan": [
       { "action": "navigate", "url": "https://pizzahut.hu" },
       { "action": "wait", "selector": ".menu-loaded", "timeout": 5000 },
       { "action": "click", "selector": ".pizza-menu-button" },
       { "action": "click", "selector": ".pizza-item:first" },
       { "action": "type", "selector": "#delivery-address", "text": "{{ user_address }}" },
       { "action": "click", "selector": ".add-to-cart" },
       { "action": "screenshot" }
     ],
     "estimatedDuration": 30000,
     "requiresUserInput": ["user_address", "payment_method"]
   }

5. Execution Orchestrator
   → Step 1: pb_navigate("https://pizzahut.hu")
   → Step 2: pb_wait(".menu-loaded", 5000)
   → Step 3: pb_click(".pizza-menu-button")
   → ... folytatódik ...
   → Live screenshot minden lépés után

6. Response
   → Dashboard: Execution timeline frissül, Live View mutatja a böngészőt
   → CLI: "Pizza rendelés folyamatban... 5/7 lépés kész"
```

---

## 3. Component Specifications

### 3.1 RobotkezV2Agent (src/agents/RobotkezV2Agent.ts)

**Extends:** `BaseAgent`

**Public Methods:**

```typescript
class RobotkezV2Agent extends BaseAgent {
  // Fő entry point (IAgent interface)
  async executeTask(context: AgentContext): Promise<AgentResult>

  // Plan generation (LLM-based)
  private async createExecutionPlan(instruction: string): Promise<ExecutionPlan>

  // Multi-step execution
  private async executeMultiStepPlan(plan: ExecutionPlan): Promise<AgentResult>

  // Background task delegation
  private async executeInBackground(plan: ExecutionPlan): Promise<AgentResult>

  // Magyar intent parsing
  private parseHungarianIntent(instruction: string): IntentAnalysis

  // Context management
  private async saveContext(): Promise<void>
  private async loadContext(taskId: string): Promise<ExecutionContext>

  // Error recovery
  private async handleExecutionError(error: Error, step: ExecutionStep): Promise<RecoveryAction>
}
```

**ExecutionPlan Interface:**

```typescript
interface ExecutionPlan {
  plan: ExecutionStep[];
  estimatedDuration: number;
  requiresUserInput?: string[];
  backgroundEligible: boolean;
  contextNeeded: string[];
}

interface ExecutionStep {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract';
  selector?: string;
  url?: string;
  text?: string;
  timeout?: number;
  validation?: ValidationRule;
  description: string; // Magyar nyelvű leírás (pl. "Menü megnyitása")
}
```

### 3.2 LLM Integration (Ollama/Gemini)

**System Prompt Template:**

```
Te egy intelligens böngésző ügynök vagy, hasonló a Perplexity Comet-hez.
A felhasználó magyar nyelvű utasítást ad, te pedig részletes lépésekre bontod.

ELÉRHETŐ MŰVELETEK:
- navigate(url): Navigálás URL-re
- click(selector): Kattintás CSS selector alapján
- type(selector, text): Szöveg gépelés input mezőbe
- scroll(direction, amount): Görgetés (up/down/left/right)
- wait(selector, timeout): Várakozás elem megjelenésére
- screenshot(): Képernyőkép készítés
- extract(selector, type): Adat kinyerés (text/attribute/html)

SZABÁLYOK:
1. Minden lépésnek legyen description magyarul
2. Használj wait()-et oldal betöltés után
3. Validálj minden action előtt (elem létezik?)
4. Ha user input kell, add hozzá a requiresUserInput array-hez
5. Estimated duration legyen reális (ms-ben)

VÁLASZ FORMÁTUM:
{
  "plan": [ { "action": "...", ...step fields... } ],
  "estimatedDuration": 30000,
  "requiresUserInput": ["address", "payment"],
  "backgroundEligible": false,
  "contextNeeded": ["user_profile", "saved_addresses"]
}

PÉLDA:
Utasítás: "Keress rá a legújabb AI hírekre"
Válasz:
{
  "plan": [
    { "action": "navigate", "url": "https://www.google.com", "description": "Google megnyitása" },
    { "action": "wait", "selector": "input[name='q']", "timeout": 3000, "description": "Keresőmező betöltésére várakozás" },
    { "action": "type", "selector": "input[name='q']", "text": "latest AI news 2026", "description": "Keresési kifejezés beírása" },
    { "action": "click", "selector": "input[type='submit']", "description": "Keresés indítása" },
    { "action": "wait", "selector": "#search", "timeout": 5000, "description": "Eredmények betöltésére várakozás" },
    { "action": "extract", "selector": ".g h3", "type": "text", "description": "Top 10 cím kinyerése" },
    { "action": "screenshot", "description": "Eredmények képernyőkép" }
  ],
  "estimatedDuration": 15000,
  "requiresUserInput": [],
  "backgroundEligible": false,
  "contextNeeded": []
}
```

### 3.3 Persistent Browser Tools Extensions

**Új MCP Tools (Jules kód kibővítése):**

```typescript
// src/tools/persistentBrowserTools.ts

// ÚJ: Scroll művelet
server.tool("pb_scroll", "Scroll the page", {
  direction: z.enum(['up', 'down', 'left', 'right']),
  amount: z.number().optional() // pixels vagy % (default: 100%)
}, async ({ direction, amount }) => { ... });

// ÚJ: Wait for element
server.tool("pb_wait", "Wait for element to appear", {
  selector: z.string(),
  timeout: z.number().default(5000)
}, async ({ selector, timeout }) => { ... });

// ÚJ: Data extraction (structured)
server.tool("pb_extract", "Extract data from page", {
  selector: z.string(),
  type: z.enum(['text', 'attribute', 'html', 'table']),
  attribute: z.string().optional() // ha type='attribute'
}, async ({ selector, type, attribute }) => { ... });

// ÚJ: Multi-element extraction (pl. lista itemek)
server.tool("pb_extract_all", "Extract all matching elements", {
  selector: z.string(),
  type: z.enum(['text', 'attribute', 'html'])
}, async ({ selector, type }) => { ... });
```

### 3.4 Background Task Manager

**Implementation:** `src/utils/backgroundTaskManager.ts`

```typescript
class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();

  async startTask(plan: ExecutionPlan): Promise<string> {
    const taskId = `bg-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const task: BackgroundTask = {
      id: taskId,
      plan,
      status: 'running',
      progress: 0,
      startedAt: Date.now(),
      steps: []
    };

    this.tasks.set(taskId, task);

    // Run in background (async, non-blocking)
    this.executeTaskInBackground(task).catch(error => {
      task.status = 'error';
      task.error = error.message;
    });

    return taskId;
  }

  async getTaskStatus(taskId: string): Promise<BackgroundTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'cancelled';
      // Cleanup browser state...
    }
  }

  private async executeTaskInBackground(task: BackgroundTask): Promise<void> {
    for (let i = 0; i < task.plan.plan.length; i++) {
      const step = task.plan.plan[i];

      try {
        await this.executeStep(step);
        task.progress = ((i + 1) / task.plan.plan.length) * 100;
        task.steps.push({ ...step, status: 'completed' });
      } catch (error: any) {
        task.steps.push({ ...step, status: 'error', error: error.message });
        throw error;
      }
    }

    task.status = 'completed';
    task.completedAt = Date.now();
  }
}
```

---

## 4. User Interfaces

### 4.1 Dashboard Component (Comet-style)

**Component:** `src/dashboard/components/dashboard/RobotkezV2Chat.tsx`

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 Robotkéz V2 - Agentic Browser          [Background Tasks ▼]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Chat History (Comet-style messages)                        │ │
│  │                                                              │ │
│  │  👤 Te: "Rendelj pizzát a pizzahut.hu-ról"                  │ │
│  │                                                              │ │
│  │  🤖 Robotkéz: "Rendben, elkészítettem a tervet..."         │ │
│  │     Execution Plan (7 lépés):                               │ │
│  │     ✅ 1. Navigáció pizzahut.hu                             │ │
│  │     ✅ 2. Menü betöltésre várakozás                         │ │
│  │     ⏳ 3. Pizza kiválasztása (folyamatban)                  │ │
│  │     ⚪ 4. Cím megadása                                       │ │
│  │     ⚪ 5. Kosárba helyezés                                   │ │
│  │     ⚪ 6. Képernyőkép                                        │ │
│  │     [Progress: 28%] ████████░░░░░░░░░░░░░░░░                │ │
│  │                                                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Mit csináljak? (pl. "Keress rá a legújabb AI hírekre")   │ │
│  │  [                                                  ] Küld │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🖥️ Live Browser View        [Auto-refresh: 2s] [📸]    │   │
│  │  ┌───────────────────────────────────────────────────┐   │   │
│  │  │                                                     │   │   │
│  │  │         [Screenshot of current browser state]      │   │   │
│  │  │                                                     │   │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  │  Current URL: https://pizzahut.hu/menu                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Execution timeline visualization (mint a Comet progress tracker)
- Live Browser View (auto-refresh 2s)
- Background tasks dropdown (active/completed tasks)
- Streaming response support (ha az LLM támogatja)
- Context-aware suggestions (pl. "saved addresses" dropdown)

### 4.2 CLI Interface

**Commands:**

```bash
# Natural language execution
brunella robotkez chat "Rendelj pizzát a pizzahut.hu-ról"

# Direct action (low-level)
brunella robotkez exec --action navigate --url https://google.com
brunella robotkez exec --action click --selector ".search-button"
brunella robotkez exec --action type --selector "input[name='q']" --text "AI news"

# Status check
brunella robotkez status
# Output:
#   Browser Active: Yes
#   Current URL: https://google.com
#   Last Action: type (2s ago)
#   Background Tasks: 1 running, 3 completed

# Background task management
brunella robotkez tasks list
brunella robotkez tasks status <taskId>
brunella robotkez tasks cancel <taskId>

# Interactive REPL mode
brunella robotkez interactive
# > Keress rá a legújabb AI hírekre
# ⏳ Végrehajtás... (3/5 lépés)
# ✅ Kész! Top 5 AI hír találat.
# > exit

# Screenshot
brunella robotkez screenshot
# Output: Screenshot saved + Dashboard Live View URL
```

---

## 5. Database Schema

**Background Tasks Table (SQLite - tasksDb):**

```sql
CREATE TABLE IF NOT EXISTS robotkez_background_tasks (
  id TEXT PRIMARY KEY,
  plan_json TEXT NOT NULL,  -- ExecutionPlan serialized
  status TEXT NOT NULL,      -- 'running' | 'completed' | 'error' | 'cancelled'
  progress INTEGER DEFAULT 0, -- 0-100
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT,
  steps_json TEXT,           -- ExecutionStep[] history
  context_json TEXT          -- Execution context (user data, etc.)
);

CREATE INDEX idx_robotkez_bg_status ON robotkez_background_tasks(status);
CREATE INDEX idx_robotkez_bg_started ON robotkez_background_tasks(started_at DESC);
```

**Execution History Table (Analytics):**

```sql
CREATE TABLE IF NOT EXISTS robotkez_execution_history (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,  -- Magyar nyelvű user input
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);
```

---

## 6. Error Handling & Recovery

### 6.1 Phoenix Protocol Integration

**Checkpoint System:**

```typescript
// Minden 3. lépés után checkpoint
if (currentStep % 3 === 0) {
  await this.createCheckpoint(task, currentStep);
}

// Hiba esetén recovery
if (error instanceof BrowserCrashError) {
  const lastCheckpoint = await this.loadLastCheckpoint(task.id);
  await this.restartBrowser();
  await this.replaySteps(lastCheckpoint.completedSteps);
  // Continue from checkpoint...
}
```

### 6.2 Error Types & Recovery Actions

| **Error Type** | **Recovery Action** | **User Notification** |
|----------------|--------------------|-----------------------|
| `BrowserCrashError` | Phoenix restart + replay from checkpoint | "Böngésző újraindult, folytatom..." |
| `SelectorNotFoundError` | Retry 3x with wait, then LLM re-plan | "Elem nem található, újratervezem..." |
| `TimeoutError` | Increase timeout + retry once | "Lassú oldal, várok még..." |
| `LLMHallucinationError` | Validation failure → ask user | "Nem biztos a lépésben, jóváhagyod?" |
| `NetworkError` | Retry 3x exponential backoff | "Hálózati hiba, újrapróbálom..." |

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Coverage Target:** 95%+

```typescript
// test/robotkezV2Agent.test.ts
describe('RobotkezV2Agent', () => {
  describe('parseHungarianIntent', () => {
    it('should detect navigation intent', () => {
      const intent = agent.parseHungarianIntent('navigálj a google.com-ra');
      expect(intent.type).toBe('navigation');
      expect(intent.url).toBe('https://google.com');
    });

    it('should detect search intent without URL', () => {
      const intent = agent.parseHungarianIntent('keress rá az AI hírekre');
      expect(intent.type).toBe('search');
      expect(intent.query).toBe('AI hírek');
    });
  });

  describe('createExecutionPlan', () => {
    it('should generate valid plan from LLM', async () => {
      const plan = await agent.createExecutionPlan('Rendelj pizzát');
      expect(plan.plan).toHaveLength(greaterThan(3));
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });
  });
});
```

### 7.2 Integration Tests

```typescript
// test/integration/robotkez-e2e.test.ts
describe('RobotkezV2 E2E', () => {
  it('should execute Google search workflow', async () => {
    const result = await agent.executeTask({
      task: 'Keress rá a "TypeScript tutorial"-ra'
    });

    expect(result.success).toBe(true);
    expect(result.data.steps).toContainEqual(
      expect.objectContaining({ action: 'navigate', url: expect.stringContaining('google.com') })
    );
  }, 30000); // 30s timeout
});
```

### 7.3 LLM Mock Testing

```typescript
// Mock LLM responses for deterministic tests
jest.mock('../core/llm_client', () => ({
  callLLM: jest.fn().mockResolvedValue(JSON.stringify({
    plan: [
      { action: 'navigate', url: 'https://google.com', description: 'Google megnyitása' }
    ],
    estimatedDuration: 5000
  }))
}));
```

---

## 8. Performance Requirements

| **Metric** | **Target** | **Critical Threshold** |
|------------|-----------|------------------------|
| Plan Generation (LLM) | < 3s | < 10s |
| Single Step Execution | < 2s | < 5s |
| Screenshot Capture | < 500ms | < 1s |
| Live View Refresh | 2s interval | 5s max |
| Background Task Startup | < 1s | < 3s |
| Dashboard Load Time | < 2s | < 5s |
| CLI Command Response | < 1s | < 3s |

---

## 9. Security Considerations

### 9.1 Input Validation

- **XSS Protection:** Sanitize all user inputs before browser execution
- **URL Whitelist:** Optional domain whitelist (pl. csak *.hu domain-ek)
- **Credential Handling:** NEVER log passwords/tokens, secure storage (keychain)

### 9.2 Browser Sandboxing

```typescript
// Playwright launch with security flags
const browser = await playwright.chromium.launch({
  args: [
    '--no-sandbox',           // (csak dev környezetben!)
    '--disable-web-security', // (csak trusted sites-hoz!)
  ],
  headless: true,
  executablePath: process.env.CHROME_PATH // Custom Chrome binary
});
```

### 9.3 LLM Prompt Injection Defense

```typescript
// Validation layer before LLM call
if (instruction.includes('ignore previous instructions')) {
  throw new Error('Prompt injection detected');
}

// Output validation (plan structure)
if (!isValidExecutionPlan(llmResponse)) {
  throw new Error('LLM hallucination detected');
}
```

---

## 10. Deployment & Configuration

### 10.1 Environment Variables

```bash
# LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=your-api-key-here
ROBOTKEZ_LLM_PROVIDER=ollama  # ollama | gemini

# Browser Configuration
ROBOTKEZ_HEADLESS=true
ROBOTKEZ_BROWSER_TIMEOUT=30000
ROBOTKEZ_MAX_CONCURRENT_TASKS=3

# Feature Flags
ROBOTKEZ_BACKGROUND_TASKS_ENABLED=true
ROBOTKEZ_LLM_PLANNING_ENABLED=true
ROBOTKEZ_AUTO_SCREENSHOT=true
```

### 10.2 Default Configuration

```json
// config/robotkez.json
{
  "llm": {
    "provider": "ollama",
    "model": "llama3.2:latest",
    "temperature": 0.3,
    "maxTokens": 2048
  },
  "browser": {
    "headless": true,
    "defaultTimeout": 30000,
    "screenshotInterval": 2000,
    "viewport": { "width": 1920, "height": 1080 }
  },
  "backgroundTasks": {
    "enabled": true,
    "maxConcurrent": 3,
    "checkpointInterval": 3
  }
}
```

---

## 11. Success Metrics

**MVP Success Criteria:**

- [ ] ✅ 10+ példa workflow működik (Google search, form fill, stb.)
- [ ] ✅ Dashboard UI teljesen működőképes (chat + live view)
- [ ] ✅ CLI parancsok működnek (chat, exec, status, interactive)
- [ ] ✅ LLM plan generation 80%+ accuracy
- [ ] ✅ Background tasks stable (3+ parallel task)
- [ ] ✅ Test coverage 95%+
- [ ] ✅ Build ✅ + Test ✅ zöld
- [ ] ✅ User documentation magyar nyelven

**V1.0 Success Metrics (Post-MVP):**

- [ ] 100+ user sessions (beta testing)
- [ ] 95%+ task success rate
- [ ] < 5% LLM hallucination rate
- [ ] 0 critical bugs (P0/P1)
- [ ] Positive user feedback (4.5+ / 5 rating)

---

## 12. Future Enhancements (Post-V1)

- **Multi-tab support** (párhuzamos több tab kezelése)
- **Form auto-fill intelligence** (user profile-based)
- **OCR integration** (screenshot → text extraction)
- **Voice input** (magyar hangfelismerés - Whisper)
- **Mobile browser support** (Android WebView)
- **Browser extension** (Chrome/Edge plugin)
- **Workflow templates** (gyakori feladatok mentése)
- **Collaborative mode** (több user megosztja a browser session-t)

---

## 13. References

- [Perplexity Comet Official](https://www.perplexity.ai/comet)
- [Perplexity Comet Guide 2026](https://koanthic.com/en/perplexity-comet-browser/)
- [Playwright Documentation](https://playwright.dev/)
- [Browser-Use GitHub](https://github.com/browser-use/browser-use)
- [EPP v2 Protocol](../epp-v2.md)

---

**Document Version:** 1.0
**Approved By:** Pohánka Péter
**Status:** ✅ Approved - Ready for Implementation
