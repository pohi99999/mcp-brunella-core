# Robotkéz Pro (BVAB) Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Építeni egy vizuálisan követhető, kettős kommunikációs interfésszel (Dashboard + Overlay Chat) és progresszív önjavító képességekkel (Self-Training Loop) rendelkező automatizációs hidat a Brunella Agent Systemhez.

**Architecture:** Node.js (Orchestrator + Socket.IO) <-> Python (FastAPI Action Server + Playwright + PyAutoGUI). Kétirányú valós idejű kommunikáció a frontend (React Dashboard + injektált Shadow DOM overlay) és az Orchestrator között. Progresszív hibajavítás (DOM, Kinetic, Computer Use, Vision).

**Tech Stack:** Node.js, Socket.IO, Python, FastAPI, Playwright, PyAutoGUI, React (Vite, Shadow DOM), Vitest/Pytest.

---

### Task 1: React Browser Overlay Chat Widget (Shadow DOM)

**Files:**
- Create: `src/dashboard/overlay/index.tsx`
- Create: `src/dashboard/overlay/OverlayChat.tsx`
- Create: `vite.overlay.config.ts`

**Step 1: Create vite build config for the overlay**
Create `vite.overlay.config.ts` to build a single standalone JS bundle that can be injected by Playwright.

**Step 2: Create the OverlayChat component**
Write `src/dashboard/overlay/OverlayChat.tsx` using standard React state, connecting to Socket.IO.

**Step 3: Create the entrypoint with Shadow DOM**
Write `src/dashboard/overlay/index.tsx` that creates a generic HTML element, attaches a ShadowRoot, and mounts the React app inside it to isolate styles.

**Step 4: Verify build**
Run: `npx vite build -c vite.overlay.config.ts`
Expected: Successfully generates `dist/overlay.bundle.js` without errors.

**Step 5: Commit**
```bash
git add src/dashboard/overlay vite.overlay.config.ts
git commit -m "feat(robotkez-pro): create shadow DOM react overlay chat widget"
```

---

### Task 2: Python Action Server - Custom Computer Use & Playwright

**Files:**
- Create: `myai/robotkez/computer_use.py`
- Modify: `myai/robotkez/browser.py`
- Modify: `myai/server.py`

**Step 1: Write Custom Computer Use Module**
Write `myai/robotkez/computer_use.py` containing a class `NativeComputerUse` with methods for native clicks (`click(x, y)`), typing (`type_text(text)`), using `pyautogui`.

**Step 2: Add Overlay Injection to Browser**
Modify `myai/robotkez/browser.py` to inject `overlay.bundle.js` into every new page using `page.add_init_script()`.

**Step 3: Write tests for NativeComputerUse**
Create `myai/tests/test_computer_use.py` to mock `pyautogui` and verify coordinate scaling.
Run: `pytest myai/tests/test_computer_use.py`
Expected: PASS

**Step 4: Expose FastAPI Endpoints**
Modify `myai/server.py` to expose `/api/robotkez/action` and `/api/robotkez/snapshot` endpoints.

**Step 5: Commit**
```bash
git add myai/robotkez myai/tests/test_computer_use.py myai/server.py
git commit -m "feat(robotkez-pro): add custom computer use and playwright overlay injection"
```

---

### Task 3: Node.js Orchestrator & Socket.IO Bridge

**Files:**
- Modify: `src/server/web.ts`
- Create: `src/orchestrator/robotkez_bridge.ts`

**Step 1: Setup Socket.IO for Overlay**
In `src/server/web.ts`, setup a specific Socket.IO namespace (e.g., `/robotkez-overlay`) to handle messages from the injected chat widget.

**Step 2: Create Orchestrator Bridge**
Write `src/orchestrator/robotkez_bridge.ts` that exports a class `RobotkezBridge`. This handles translating user intents from the chat into Python API calls (`/api/robotkez/action`).

**Step 3: Add Unit Test for Bridge**
Create `test/robotkez-pro/bridge.test.ts` mocking the `fetch` calls to the Python API.
Run: `npx vitest run test/robotkez-pro/bridge.test.ts`
Expected: PASS

**Step 4: Commit**
```bash
git add src/server/web.ts src/orchestrator/robotkez_bridge.ts test/robotkez-pro/bridge.test.ts
git commit -m "feat(robotkez-pro): integrate socket.io and orchestrator bridge"
```

---

### Task 4: Self-Training Loop (Progressive Escalation & Memory)

**Files:**
- Create: `src/orchestrator/self_training_loop.ts`

**Step 1: Define Memory Storage**
In `self_training_loop.ts`, implement `loadMemory()` and `saveMemory()` using `fs.promises` to read/write `data/robotkez_memory.json`.

**Step 2: Implement Progressive Escalation Logic**
Create `executeWithRetry(task)` that implements the 4-level fallback:
1. DOM Check
2. Kinetic (Scroll)
3. Native Computer Use
4. Vision API Check (mocked initially)

**Step 3: Test Escalation Logic**
Modify our existing mock test `test/robotkez-pro/self-training-loop.test.ts` to use the real `executeWithRetry` function (with mocked dependencies).
Run: `npx vitest run test/robotkez-pro/self-training-loop.test.ts`
Expected: PASS

**Step 4: Commit**
```bash
git add src/orchestrator/self_training_loop.ts test/robotkez-pro/self-training-loop.test.ts
git commit -m "feat(robotkez-pro): implement self-training loop with progressive escalation"
```
