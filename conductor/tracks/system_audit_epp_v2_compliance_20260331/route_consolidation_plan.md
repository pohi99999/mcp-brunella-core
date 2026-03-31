# Route Consolidation & Dashboard Panel Registration Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up `web.ts` by moving route registrations to `src/server/routes/index.ts` and register missing high-value Dashboard panels.

**Architecture:** Centralize all API v1 routes in `createV1Router` and ensure the Dashboard's `NavigationRegistry` is complete.

---

### Task 1: Consolidate Routes in src/server/routes/index.ts

**Files:**
- Modify: `src/server/routes/index.ts`
- Modify: `src/server/web.ts`

**Step 1: Move registrations from web.ts to index.ts**
Identify routes mounted on `v1Router` in `web.ts` that are NOT in `index.ts` and move them.

**Step 2: Remove redundant registrations in web.ts**
Ensure `web.ts` only calls `createV1Router()` and mounts it once.

### Task 2: Register High-Value Dashboard Panels

**Files:**
- Modify: `src/dashboard/lib/navigation.tsx`

**Step 1: Register AdminSelfCheckWidget**
**Step 2: Register CognitiveMemoryPanel**
**Step 3: Register TraceViewer**
**Step 4: Register LogViewer**
... (and others identified as high-value)

### Task 3: Final Python Log Cleanup

**Files:**
- Modify: `myai/agents/comet/*.py`
- Modify: `myai/upload_trojan_to_sheets.py` (ensure all Hungarian chars in logs are gone)

---
