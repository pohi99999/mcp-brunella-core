# RobotkezV2 - Developer Guide

**Version:** 1.0.0
**Last Updated:** 2026-02-15

---

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [LLM Planning](#llm-planning)
4. [Adding Custom Actions](#adding-custom-actions)
5. [API Reference](#api-reference)
6. [Testing](#testing)
7. [Deployment](#deployment)

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  RobotkezV2Chat.tsx → WebSocket → Backend API               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Express + TS)                    │
│  /api/v1/robotkez/* → RobotkezV2Agent.executeTask()         │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼────────┐ ┌────▼─────┐ ┌────────▼──────────┐
│  LLM Planner     │ │ Browser  │ │ Background Tasks  │
│  (GPT-4o/Gemini) │ │ Bridge   │ │ Manager           │
└──────────────────┘ └──────────┘ └───────────────────┘
          │                │                │
          │          ┌─────▼──────┐         │
          │          │  Python    │         │
          │          │  Playwright│         │
          │          └────────────┘         │
          │                                 │
          └─────────────────────────────────┘
                      SQLite DB
```

### Component Interaction Flow

1. **User Input** → Dashboard or CLI
2. **RobotkezV2Agent** receives instruction
3. **LLM Planner** generates `ExecutionPlan` (multi-step)
4. **Agent** executes each step via **Persistent Browser**
5. **Python Bridge** (FastAPI) controls Playwright
6. **Background Task Manager** handles long-running tasks (> 30s)
7. **WebSocket** pushes real-time updates to Dashboard

---

## Core Components

### 1. RobotkezV2Agent (src/agents/RobotkezV2Agent.ts)

**Main entry point** for all browser automation tasks.

```typescript
export class RobotkezV2Agent extends BaseAgent {
  name = 'RobotkezV2';
  role = 'Magyar Agentic Browser';

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // 1. Generate LLM plan
    const plan = await generateExecutionPlan(instruction);

    // 2. Check background eligibility
    if (plan.backgroundEligible || plan.estimatedDuration > 30000) {
      return backgroundTaskManager.startTask(instruction, plan);
    }

    // 3. Execute steps synchronously
    for (const step of plan.plan) {
      await this.executeStep(step);
    }

    return { success: true, data: completedSteps };
  }
}
```

**Key Methods:**
- `executeTask()` - Main entry point
- `executeStep()` - Single step execution (navigate, click, type, etc.)
- `parseHungarianIntent()` - Fallback simple intent parsing (Phase 2 MVP)
- `executeSimplePlan()` - Direct execution without LLM
- `executeInBackground()` - Manual background delegation
- `getBackgroundTaskStatus()` - Query task progress

---

### 2. LLM Planner (src/utils/llmPlanner.ts)

**Converts natural language → structured execution plan**

```typescript
export async function generateExecutionPlan(instruction: string): Promise<ExecutionPlan> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\nUtasítás: ${instruction}`;

  // Call LLM (GitHub Models GPT-4o or Gemini)
  const response = await generateResponse(fullPrompt, 'github', 'gpt-4o');

  // Parse JSON response
  const plan = JSON.parse(response) as ExecutionPlan;

  // Validate
  if (!plan.plan || !Array.isArray(plan.plan)) {
    throw new Error('Invalid plan structure');
  }

  return plan;
}
```

**Execution Plan Structure:**

```typescript
interface ExecutionPlan {
  plan: ExecutionStep[];           // Array of steps
  estimatedDuration: number;       // Total ms
  requiresUserInput?: string[];    // Fields needing input (e.g., password)
  backgroundEligible: boolean;     // Auto-delegate to background?
  contextNeeded?: string[];        // External context required
}

interface ExecutionStep {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract';
  selector?: string;               // CSS selector (e.g., "input[name='q']")
  url?: string;                    // For navigate
  text?: string;                   // For type
  timeout?: number;                // For wait (ms)
  direction?: 'up' | 'down';       // For scroll
  amount?: number;                 // Scroll pixels
  type?: 'text' | 'attribute';     // For extract
  attribute?: string;              // For extract attribute
  description: string;             // Magyar description (e.g., "Google megnyitása")
}
```

---

### 3. Persistent Browser (src/utils/persistentBrowser.ts)

**TypeScript ↔ Python bridge for Playwright session**

```typescript
export const persistentBrowser = {
  async sendCommand(command: BrowserCommand): Promise<BrowserResponse> {
    // POST to Python FastAPI server
    const response = await fetch('http://localhost:8000/browser/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });

    return await response.json();
  }
};
```

**Python Backend (myai/server.py):**

```python
@app.post("/browser/command")
async def execute_browser_command(command: BrowserCommand):
    action = command.action

    if action == "navigate":
        await page.goto(command.url)
        return {"status": "success", "url": page.url}

    elif action == "click":
        await page.click(command.selector)
        return {"status": "success"}

    elif action == "type":
        await page.fill(command.selector, command.text)
        return {"status": "success"}

    # ... more actions
```

---

### 4. Background Task Manager (src/utils/backgroundTaskManager.ts)

**Handles long-running tasks asynchronously**

```typescript
class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();

  async startTask(instruction: string, plan: ExecutionPlan): Promise<string> {
    const taskId = `task_${Date.now()}`;

    const task: BackgroundTask = {
      taskId,
      instruction,
      plan,
      status: 'running',
      startTime: Date.now(),
      completedSteps: []
    };

    this.tasks.set(taskId, task);

    // Execute asynchronously
    this.executeTaskAsync(taskId, plan).catch(() => {});

    return taskId;
  }

  getTaskStatus(taskId: string): BackgroundTask | null {
    return this.tasks.get(taskId) || null;
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'cancelled';
      return true;
    }
    return false;
  }
}
```

---

## LLM Planning

### Prompt Engineering

**System Prompt Template** (`src/utils/llmPlanner.ts:48-101`):

Key rules:
1. **Magyar descriptions** - Every step must have Hungarian description
2. **Generic CSS selectors** - Avoid specific IDs (use `input[type='text']` not `#searchbox-123`)
3. **Long timeouts** - Min 8-10s for wait actions (pages load slowly!)
4. **Wait after navigate** - Always wait for first interactive element to load
5. **Background eligibility** - Flag tasks > 30s for auto-delegation

**Example Prompt:**

```
Utasítás: Navigálj a google.com-ra és keress rá az "AI hírek" kifejezésre

Expected LLM Response:
{
  "plan": [
    { "action": "navigate", "url": "https://www.google.com", "description": "Google megnyitása" },
    { "action": "wait", "selector": "textarea[name='q']", "timeout": 10000, "description": "Keresőmező betöltése" },
    { "action": "type", "selector": "textarea[name='q']", "text": "AI hírek", "description": "Keresőszó beírása" },
    { "action": "click", "selector": "input[type='submit']", "description": "Keresés indítása" }
  ],
  "estimatedDuration": 20000,
  "requiresUserInput": [],
  "backgroundEligible": false
}
```

### Handling LLM Errors

**Fallback Mechanism:**

```typescript
try {
  plan = await generateExecutionPlan(instruction);
} catch (llmError) {
  // Fallback to Phase 2 simple regex parsing
  const intent = this.parseHungarianIntent(instruction);
  const result = await this.executeSimplePlan(intent);
  return { success: true, message: result.message + ' (fallback mode)' };
}
```

**Validation:**

```typescript
// Validate plan structure
if (!plan.plan || !Array.isArray(plan.plan)) {
  throw new Error('Invalid plan structure from LLM');
}

// Validate each step
for (const step of plan.plan) {
  if (step.action === 'click' && !step.selector) {
    throw new Error('Click action requires selector');
  }
  if (step.action === 'navigate' && !step.url) {
    throw new Error('Navigate action requires url');
  }
}
```

---

## Adding Custom Actions

### Step 1: Extend Interfaces

**src/utils/llmPlanner.ts:**

```typescript
export interface ExecutionStep {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract'
    | 'hover';  // ✅ NEW ACTION
  // ...
  element?: string;  // ✅ NEW PARAM for hover
}
```

### Step 2: Update Agent executeStep()

**src/agents/RobotkezV2Agent.ts:210-269:**

```typescript
private async executeStep(step: ExecutionStep): Promise<void> {
  switch (step.action) {
    // ... existing cases

    case 'hover':  // ✅ NEW
      if (!step.selector) throw new Error('Hover requires selector');
      await persistentBrowser.sendCommand({
        action: 'hover',
        selector: step.selector
      });
      break;

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}
```

### Step 3: Implement Browser Bridge

**src/utils/persistentBrowser.ts:**

```typescript
export interface BrowserCommand {
  action: 'launch' | 'navigate' | 'click' | 'type' | 'screenshot' | 'content'
    | 'scroll' | 'wait' | 'extract' | 'close'
    | 'hover';  // ✅ NEW
  // ...
}
```

### Step 4: Python Implementation

**myai/server.py:**

```python
@app.post("/browser/command")
async def execute_browser_command(command: BrowserCommand):
    # ... existing actions

    elif action == "hover":  # ✅ NEW
        await page.hover(command.selector)
        return {"status": "success", "message": f"Hovered on {command.selector}"}
```

### Step 5: Update LLM Prompt

**src/utils/llmPlanner.ts SYSTEM_PROMPT:**

```typescript
const SYSTEM_PROMPT = `...
ELÉRHETŐ MŰVELETEK:
- navigate(url): Navigálás URL-re
- click(selector): Kattintás CSS selector alapján
- type(selector, text): Szöveg gépelés
- scroll(direction, amount): Görgetés
- wait(selector, timeout): Várakozás elem megjelenésére
- screenshot(): Képernyőkép
- extract(selector, type): Adat kinyerés
- hover(selector): Egér hover elem fölött  ✅ NEW
...`;
```

### Step 6: Add Tests

**test/robotkezV2Agent.test.ts:**

```typescript
it('should execute hover action', async () => {
  const step: ExecutionStep = {
    action: 'hover',
    selector: '.menu-item',
    description: 'Hover over menu'
  };

  await agent['executeStep'](step);  // Private method test

  // Assert: persistentBrowser.sendCommand called with hover
  expect(mockSendCommand).toHaveBeenCalledWith({
    action: 'hover',
    selector: '.menu-item'
  });
});
```

---

## API Reference

### REST Endpoints

**Base URL:** `http://localhost:3000/api/v1/robotkez`

#### POST /chat

Natural language chat interface

**Request:**
```json
{
  "instruction": "Navigálj a google.com-ra"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Végrehajtva: 2 lépés sikeres",
  "data": {
    "plan": [...],
    "completedSteps": [...]
  },
  "thoughts": "LLM-generated plan executed successfully"
}
```

#### POST /plan

Generate execution plan WITHOUT executing

**Request:**
```json
{
  "instruction": "Keress rá az AI hírekre"
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "plan": [
      { "action": "navigate", "url": "https://google.com", "description": "..." },
      { "action": "type", "selector": "input", "text": "AI hírek", "description": "..." }
    ],
    "estimatedDuration": 15000,
    "backgroundEligible": false
  }
}
```

#### POST /exec

Direct browser action execution

**Request:**
```json
{
  "action": "navigate",
  "url": "https://google.com"
}
```

**Response:**
```json
{
  "success": true,
  "result": { "status": "success", "url": "https://google.com" },
  "message": "Action executed: navigate"
}
```

#### GET /status

Agent and browser status

**Response:**
```json
{
  "success": true,
  "agent": {
    "name": "RobotkezV2",
    "role": "Magyar Agentic Browser",
    "capabilities": ["agentic_browsing", "multi_step_automation", ...]
  },
  "browser": {
    "active": true,
    "type": "persistent",
    "engine": "Playwright + Python"
  },
  "browserStatus": "idle",
  "tasks": {
    "total": 5,
    "running": 1,
    "completed": 4,
    "error": 0
  }
}
```

#### GET /tasks

List all background tasks

**Query Params:**
- `status` (optional): `running` | `completed` | `error` | `cancelled`
- `limit` (optional): Max results (default: 50)

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "task_123",
      "instruction": "...",
      "status": "running",
      "startTime": 1645123456789,
      "completedSteps": [...]
    }
  ]
}
```

#### GET /tasks/:id

Get specific task status

**Response:**
```json
{
  "success": true,
  "task": {
    "taskId": "task_123",
    "instruction": "Navigálj 5 oldalra",
    "status": "completed",
    "startTime": 1645123456789,
    "endTime": 1645123487654,
    "completedSteps": [...],
    "duration": 30865
  }
}
```

#### DELETE /tasks/:id

Cancel running task

**Response:**
```json
{
  "success": true,
  "message": "Task cancelled: task_123"
}
```

---

## Testing

### Unit Tests

**Run all agent tests:**
```bash
npx vitest run test/robotkezV2Agent.test.ts
```

**Coverage:** 19 tests (intent parsing, execution, error handling)

### E2E Tests

**Run integration tests:**
```bash
npx vitest run test/robotkezV2.e2e.test.ts
```

**10 Scenarios:**
1. Google search
2. Form fill
3. Multi-step workflow
4. Background task
5. Error recovery
6. LLM hallucination
7. Phoenix protocol (crash recovery)
8. Screenshot capture
9. Data extraction
10. Parallel tasks

**Current Status:** 5/10 PASS (5 known issues - Google edge cases)

### Mocking

**Mock LLM Planning:**

```typescript
import { vi } from 'vitest';
import * as llmClient from '../src/core/llm_client.js';

vi.spyOn(llmClient, 'generateResponse').mockResolvedValue(JSON.stringify({
  plan: [
    { action: 'navigate', url: 'https://example.com', description: 'Test' }
  ],
  estimatedDuration: 5000,
  backgroundEligible: false
}));
```

**Mock Persistent Browser:**

```typescript
vi.mock('../src/utils/persistentBrowser', () => ({
  persistentBrowser: {
    sendCommand: vi.fn().mockResolvedValue({ status: 'success' })
  }
}));
```

---

## Deployment

### Production Build

```bash
npm run build        # TypeScript → JavaScript (build/)
npm test             # All tests must pass ✅
```

### Environment Variables

**Required:**
```env
GITHUB_PAT=github_pat_...          # OR
GEMINI_API_KEY=...                 # Choose one LLM provider

BRUNELLA_WORKSPACE_ROOT=.
OLLAMA_BASE_URL=http://localhost:11434  # (fallback)
```

**Optional:**
```env
LLM_TIMEOUT_MS=120000              # 2 minutes default
ROBOTKEZ_SCREENSHOT_DIR=./screenshots
```

### Server Start

```bash
# Production mode
NODE_ENV=production npm run dev

# OR with PM2
pm2 start npm --name "brunella-backend" -- run dev
pm2 start npm --name "brunella-dashboard" -- run dev:ui
```

### Docker (Future)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "dev"]
```

---

## Contributing

### Code Style

- **ESM imports:** Always use `.js` extension → `import { foo } from './bar.js'`
- **Logging:** Use `logger.ts` functions, NOT `console.log()`
- **Types:** Avoid `any`, prefer `unknown` or explicit types
- **Error handling:** Always use try/finally in agent methods

### Pull Request Checklist

- [ ] `npm run build` ✅
- [ ] `npm test` ✅ (all tests pass)
- [ ] `npm run lint` ✅
- [ ] Unit tests added for new features
- [ ] Documentation updated (if public API changed)
- [ ] CHANGELOG.md entry added

---

**Maintainer:** Claude Code + Pohánka Péter
**License:** MIT
**Repository:** https://github.com/yourusername/brunella-core
