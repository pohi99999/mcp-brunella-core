# Monorepo Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix path drift issues in the monorepo by introducing a dynamic path resolver, dynamically handling MCP server paths, and ensuring browser-safe imports for the dashboard.

**Architecture:** Introduce a centralized `PathResolver` utility using `import.meta.url`. Update the MCP server loader to resolve `{{PROJECT_ROOT}}` tokens in `mcp_servers.json`. Synchronize Vite aliases with the workspace configuration.

**Tech Stack:** TypeScript, Node.js (ESM), Vite, Vitest.

---

### Task 1: Centralized Path Resolver Utility

**Files:**
- Create: `packages/utils/pathResolver.ts`
- Test: `tests/test/pathResolver.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { PROJECT_ROOT, resolvePath } from '../packages/utils/pathResolver.js';
import path from 'path';

describe('PathResolver', () => {
  it('should identify the project root containing package.json', () => {
    expect(PROJECT_ROOT).toContain('mcp-brunella-core');
  });

  it('should resolve a relative path to an absolute path from root', () => {
    const resolved = resolvePath('package.json');
    expect(resolved).toBe(path.resolve(PROJECT_ROOT, 'package.json'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest tests/test/pathResolver.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From packages/utils/pathResolver.ts, root is two levels up
export const PROJECT_ROOT = path.resolve(__dirname, '../../');

export const resolvePath = (relative: string): string => {
  return path.resolve(PROJECT_ROOT, relative);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest tests/test/pathResolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/utils/pathResolver.ts tests/test/pathResolver.test.ts
git commit -m "feat: add centralized path resolver utility"
```

---

### Task 2: Dynamic MCP Configuration Loading

**Files:**
- Modify: `mcp_servers.json`
- Modify: `src/server/registry.ts`
- Test: `tests/test/mcp_registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveMcpPaths } from '../src/server/registry.js';

describe('MCP Path Resolution', () => {
  it('should replace {{PROJECT_ROOT}} token with actual root', () => {
    const config = { command: 'node', args: ['{{PROJECT_ROOT}}/test.js'] };
    const resolved = resolveMcpPaths(config);
    expect(resolved.args[0]).not.toContain('{{PROJECT_ROOT}}');
    expect(resolved.args[0]).toContain('mcp-brunella-core');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest tests/test/mcp_registry.test.ts`
Expected: FAIL (resolveMcpPaths is not a function)

- [ ] **Step 3: Write minimal implementation in `src/server/registry.ts`**

```typescript
import { PROJECT_ROOT } from '../../packages/utils/pathResolver.js';

export function resolveMcpPaths(config: any): any {
  const configStr = JSON.stringify(config);
  const resolvedStr = configStr.replace(/\{\{PROJECT_ROOT\}\}/g, PROJECT_ROOT.replace(/\\/g, '/'));
  return JSON.parse(resolvedStr);
}

// Update the loader to use this function when reading mcp_servers.json
```

- [ ] **Step 4: Update `mcp_servers.json` with tokens**

Replace absolute paths like `C:/Users/pohi9/Documents/mcp-brunella-core` with `{{PROJECT_ROOT}}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest tests/test/mcp_registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mcp_servers.json src/server/registry.ts tests/test/mcp_registry.test.ts
git commit -m "feat: enable dynamic path resolution in MCP configuration"
```

---

### Task 3: Stabilize Agent Loading

**Files:**
- Modify: `packages/agents/agentLoader.ts`
- Modify: `packages/agents/AgentManager.ts`

- [ ] **Step 1: Update AgentLoader to use PathResolver**

Replace `process.cwd()` usages in `AgentManager.ts` and `agentLoader.ts` with `PROJECT_ROOT` from `pathResolver.ts`.

- [ ] **Step 2: Verify with build**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add packages/agents/agentLoader.ts packages/agents/AgentManager.ts
git commit -m "fix: use PROJECT_ROOT instead of process.cwd in agent loading"
```

---

### Task 4: Dashboard Browser-Safe Imports and Aliases

**Files:**
- Modify: `apps/dashboard/vite.config.ts`
- Modify: `packages/utils/logger.ts` (if it contains Node-only logic)

- [ ] **Step 1: Sync Vite config aliases**

Ensure `vite.config.ts` correctly resolves `@packages` to the absolute monorepo path using the new logic.

- [ ] **Step 2: Check for Node-only imports in UI-imported modules**

Grep `@packages` modules used by dashboard for `fs`, `path`, `child_process`. Add environment guards if found.

- [ ] **Step 3: Run dashboard build**

Run: `npm run build:ui`
Expected: SUCCESS (no "fs" module errors)

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/vite.config.ts packages/utils/logger.ts
git commit -m "fix: ensure browser-safe imports and sync vite aliases"
```

---

### Task 5: Final Validation and Sync

- [ ] **Step 1: Run fast audit**

Run: `npm run test:fast`
Expected: 100% PASS

- [ ] **Step 2: Run full system smoke test**

Run: `dashboard.bat` (manually verify CLI and UI connectivity)

- [ ] **Step 3: Sync Documentation**

Run: `npm run sync:docs`
Run: `npm run sync:doc-stats`

- [ ] **Step 4: GitHub Push**

```bash
git push origin main
```
