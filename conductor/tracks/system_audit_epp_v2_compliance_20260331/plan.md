# EPP v2 Compliance & System Stabilization Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** centralized agent status management, ESM import standardization, and logger usage cleanup to achieve full EPP v2 compliance.

**Architecture:** Centralize the `finally` block logic in `BaseAgent.ts` to ensure status reset across all extending agents. Standardize backend imports and replace remaining `console.log` calls with the structured logger.

**Tech Stack:** TypeScript, Node.js (ESM), Vitest.

---

### Task 1: Centralize Agent Status Management in BaseAgent

**Files:**
- Modify: `src/agents/BaseAgent.ts`
- Modify: `src/agents/SpecWriterAgent.ts` (and others extending BaseAgent) to remove redundant finally blocks.

**Step 1: Update BaseAgent.ts to include finally block and setAgentStatus import**

```typescript
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
// ... in execute() ...
try {
  // ... existing logic ...
  const result = await this.executeTask(agentContext);
  // ... existing logic ...
} finally {
  setAgentStatus(this.name, 'idle');
}
```

**Step 2: Remove redundant finally blocks from SpecWriterAgent.ts**

**Step 3: Verify build and basic agent tests**
Run: `npm run build && npx vitest run test/BaseAgent.test.ts` (if exists)

### Task 2: Fix DeveloperAgent.ts Compliance

**Files:**
- Modify: `src/agents/DeveloperAgent.ts`

**Step 1: Add finally block to execute method**

```typescript
    } finally {
      setAgentStatus(this.name, "idle");
    }
```

**Step 2: Verify with test**
Run: `npx vitest run test/DeveloperAgent.test.ts`

### Task 3: Audit and Fix other standalone agents

**Files:**
- Modify: `src/agents/OrchestratorAgent.ts`
- Modify: `src/agents/PythonAgent.ts`
- ... (others implementing IAgent directly)

**Step 1: Add finally blocks where missing.**

### Task 4: Standardize Studio Templates

**Files:**
- Modify: `src/server/routes/studio.ts`

**Step 1: Update scaffold templates to use .js extensions if they are part of an ESM output.**
Note: If these are purely for Vite browser consumption, standard Vite rules apply, but the .js extension is safer for dual-use.

### Task 5: Logger Cleanup in Utilities

**Files:**
- Modify: `src/utils/db.ts`

**Step 1: Replace console.log/error with logInfo/logError.**

---
