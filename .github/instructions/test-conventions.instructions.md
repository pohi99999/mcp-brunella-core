---
description: "Use when writing, editing, or reviewing test files in the BAS project. Covers Vitest-specific APIs, timeout config, parallelism rules, mock patterns, and common test anti-patterns."
applyTo: "test/**"
---

# BAS Test Conventions

## Test runner: Vitest (NOT Jest)

- Always use `vi.*` APIs — **never** `jest.*`
- `vi.fn()`, `vi.mock()`, `vi.spyOn()`, `vi.useFakeTimers()`, `vi.advanceTimersByTime()`
- Import from `vitest`: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';`

## Global configuration (vitest.config.ts)

- `fileParallelism: false` — tests run sequentially in a single fork; do not assume isolation between files
- Default timeout: **15 seconds** per test — do not exceed without explicit `{ timeout: N }` option
- `globals: true` — `describe`, `it`, `expect` are globally available (no explicit import needed, but explicit is clearer)

## Mock patterns

```ts
// Module mock — always at the TOP of the file, before imports
vi.mock('../src/utils/health.js', () => ({
  checkOllamaHealth: vi.fn().mockResolvedValue({ status: 'ok', model: 'llama3' }),
  checkWabHealth: vi.fn().mockResolvedValue({ status: 'ok' }),   // ← include ALL exports
  buildHealthResponse: vi.fn().mockImplementation(
    // buildHealthResponse takes 10 args: (ollama, al, py, n8n, lf, wab, cf, agentCount, mcpCount, requestId)
    (ol, al, py, n8n, lf, wab, cf, ac, mc, rid) => ({
      status: 'ok',
      components: { ollama: ol, anythingllm: al, python: py, n8n, langflow: lf, wab, cloudflare: cf },
      stats: { agents: ac, mcp: mc },
      requestId: rid,
    })
  ),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Common pitfalls

- **`buildHealthResponse` has 10 parameters** — `(ollama, anythingllm, python, n8n, langflow, wab, cloudflare, agentCount, mcpCount, requestId)`. Mock must match all 10 or the assert silently gets the real value.
- **Missing exports in mock factory** — if any export is omitted from `vi.mock(...)`, the real implementation runs → unexpected behavior.
- **`better-sqlite3` in tests** — if tests that use SQLite fail with `Cannot find module` / binding errors, run `npm rebuild better-sqlite3` outside the test (Node v24 ABI issue).
- **`federation_replay_nonces_runtime` INSERT** — the `created_at` column is `NOT NULL`; always pass `datetime('now')` explicitly, `DEFAULT` does not fire on `INSERT OR REPLACE`.

## File & naming conventions

```text
test/
├── foo.test.ts                     # unit
├── fooIntegration.test.ts          # integration (hits DB / real modules)
└── federation/
    └── federationReplayGuard.test.ts
```

- One test file per source module when possible
- Use `describe('ClassName / feature')` → `it('should <do thing> when <condition>')`
- `beforeEach` for setup, `afterEach` for teardown (not `beforeAll` unless truly shared state)

## Running tests

```bash
npx vitest run test/foo.test.ts            # single file (fastest feedback loop)
npm run test:fast                          # fast subset — required before every commit
npm test                                   # full suite + build (before push / release)
npm run test:dashboard                     # dashboard-specific config (separate tsconfig)
npm run test:ui                            # UI component tests
```
