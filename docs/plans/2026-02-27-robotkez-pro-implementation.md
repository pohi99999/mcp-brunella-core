# Robotkéz Pro Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous AI operator capable of controlling Windows and Chrome with high precision using a hybrid Vision and UI Tree approach.

**Architecture:** A Python-based "Action Server" (FastAPI) acts as a bridge between the Brunella Orchestrator and the OS. It uses Playwright for browser control and PyAutoGUI/UIA for system actions, supported by a Vision loop for verification and retries.

**Tech Stack:** FastAPI, Playwright, PyAutoGUI, OpenAI/Gemini Vision API, Node.js (backend integration).

---

### Task 1: Action Server Skeleton

**Files:**
- Create: `myai/robotkez_pro/main.py`
- Create: `myai/robotkez_pro/requirements.txt`

**Step 1: Write requirements.txt**

```text
fastapi
uvicorn
pydantic
openai
playwright
pyautogui
python-dotenv
```

**Step 2: Create basic FastAPI app**

```python
from fastapi import FastAPI
app = FastAPI(title="Robotkez Pro Action Server")

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
```

**Step 3: Commit**

```bash
git add myai/robotkez_pro/
git commit -m "feat(robotkez-pro): initialize action server skeleton"
```

---

### Task 2: Playwright Visible Mode Integration

**Files:**
- Modify: `myai/robotkez_pro/main.py`

**Step 1: Implement Browser controller**

```python
from playwright.async_api import async_playwright

class BrowserManager:
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None

    async def start(self):
        pw = await async_playwright().start()
        self.browser = await pw.chromium.launch(headless=False)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()
```

**Step 2: Add endpoint to navigate**

```python
@app.post("/navigate")
async def navigate(url: str):
    await browser_manager.page.goto(url)
    return {"status": "success"}
```

**Step 3: Commit**

```bash
git commit -am "feat(robotkez-pro): add visible playwright controller"
```

---

### Task 3: Vision & Retry Loop (3 Retries)

**Files:**
- Modify: `myai/robotkez_pro/main.py`

**Step 1: Implement Action with Verification**

```python
async def perform_action_with_retry(action_fn, verify_fn, max_retries=3):
    for i in range(max_retries):
        await action_fn()
        if await verify_fn():
            return True
        print(f"Retry {i+1}...")
    return False
```

**Step 2: Add Vision-based coordinate detection (Mock for now)**

```python
async def get_coordinates_from_vision(screenshot_path, prompt):
    # Call OpenAI/Gemini Vision here
    return {"x": 500, "y": 500}
```

**Step 3: Commit**

```bash
git commit -am "feat(robotkez-pro): implement retry logic and vision stubs"
```

---

### Task 4: Node.js Backend Bridge

**Files:**
- Create: `src/services/RobotkezProService.ts`
- Modify: `src/server/routes/index.ts`

**Step 1: Create Service to talk to Python**

```typescript
export class RobotkezProService {
    async sendTask(task: string) {
        return await fetch('http://localhost:8090/execute', {
            method: 'POST',
            body: JSON.stringify({ task })
        });
    }
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(robotkez-pro): add node.js backend service bridge"
```
