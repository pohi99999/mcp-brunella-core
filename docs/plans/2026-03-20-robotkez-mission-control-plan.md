# RobotkĂ©z V2 - Collaborative Mission Control Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a professional collaborative browser control interface with real-time plan tracking and interactive vision feedback.

**Architecture:** A three-way synchronization between React Frontend (Dashboard), Node.js Backend (Agent Logic), and Python Subsystem (Playwright/Chrome). Uses Socket.IO for real-time state and image streaming.

**Tech Stack:** TypeScript, Node.js, Socket.IO, Python FastAPI, Playwright, React.

---

### Task 1: Fix Binary Screenshot Issue & Consolidate Python API

**Files:**
- Modify: myai/server.py
- Modify: src/agents/RobotkezV2Agent.ts

**Step 1: Consolidate Python screenshot endpoint to always return JSON with base64**
`python
# In myai/server.py
@app.get("/browser/screenshot")
async def browser_screenshot():
    # ... existing playwright setup ...
    screenshot_bytes = await page.screenshot()
    screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')
    return {"status": "success", "screenshot": screenshot_base64}
`

**Step 2: Update Agent to handle JSON response**
Update 	akeScreenshot in RobotkezV2Agent.ts to expect JSON instead of raw buffer.

**Step 3: Commit**
`ash
git add myai/server.py src/agents/RobotkezV2Agent.ts
git commit -m "fix: consolidate screenshot API to JSON/base64"
`

---

### Task 2: Implement CollaborationManager (Backend)

**Files:**
- Create: src/services/CollaborationManager.ts
- Modify: src/agents/RobotkezV2Agent.ts

**Step 1: Create the Manager to hold session state (current plan, status, logs)**
**Step 2: Connect Agent lifecycle events to the Manager**
**Step 3: Emit consolidated state via Socket.IO**

---

### Task 3: Interactive Canvas & Coordinate Mapping (Frontend)

**Files:**
- Create: src/dashboard/components/dashboard/RobotkezMissionControl.tsx
- Modify: src/dashboard/components/dashboard/RobotkezPanel.tsx

**Step 1: Create the Canvas component that calculates relative click coordinates (0-1000)**
**Step 2: Implement 'manual_click' socket event emission**
**Step 3: Add visual overlay for AI-detected elements**

---

### Task 4: Real-time Plan Tracking (Frontend)

**Files:**
- Create: src/dashboard/components/dashboard/PlanTracker.tsx

**Step 1: Implement hierarchical task list with status icons**
**Step 2: Connect to 'robotkez:plan' and 'robotkez:step' socket events**
**Step 3: Add 'Ask for Help' UI triggers**

---

### Task 5: DevTools Integration & Validation

**Files:**
- Modify: myai/server.py
- Modify: src/agents/RobotkezV2Agent.ts

**Step 1: Extend Python API to include network/console errors in step results**
**Step 2: Update Agent to pause on critical DevTools errors**
**Step 3: Final E2E testing of the collaborative workflow**
