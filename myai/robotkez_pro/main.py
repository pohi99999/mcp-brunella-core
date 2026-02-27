from fastapi import FastAPI, HTTPException
import uvicorn
from playwright.async_api import async_playwright

app = FastAPI(title="Robotkez Pro Action Server")

class BrowserManager:
    def __init__(self):
        self.pw = None
        self.browser = None
        self.context = None
        self.page = None

    async def start(self):
        if not self.browser:
            self.pw = await async_playwright().start()
            self.browser = await self.pw.chromium.launch(headless=False)
            self.context = await self.browser.new_context()
            self.page = await self.context.new_page()

    async def stop(self):
        if self.browser:
            await self.browser.close()
            await self.pw.stop()
            self.browser = None

browser_manager = BrowserManager()

@app.on_event("startup")
async def startup_event():
    await browser_manager.start()

@app.on_event("shutdown")
async def shutdown_event():
    await browser_manager.stop()

@app.get("/health")
async def health():
    return {"status": "ok", "browser_active": browser_manager.browser is not None}

@app.post("/navigate")
async def navigate(url: str):
    if not browser_manager.page:
        await browser_manager.start()
    try:
        await browser_manager.page.goto(url)
        return {"status": "success", "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def perform_action_with_retry(action_fn, verify_fn, max_retries=3):
    for i in range(max_retries):
        try:
            await action_fn()
            if await verify_fn():
                return True
        except Exception as e:
            print(f"Action attempt {i+1} failed: {e}")
        print(f"Retry {i+1}...")
    return False

async def get_coordinates_from_vision(screenshot_path: str, prompt: str):
    # This is a stub for calling OpenAI/Gemini Vision API
    # Logic to be implemented: 
    # 1. Take screenshot
    # 2. Send to Vision model with prompt
    # 3. Parse coordinates from response
    return {"x": 500, "y": 500}

@app.post("/execute")
async def execute_task(task: str):
    # This will be the main entry point for orchestrator tasks
    # For now, it's a stub demonstrating the retry logic
    async def dummy_action():
        print(f"Executing: {task}")
    
    async def dummy_verify():
        return True

    success = await perform_action_with_retry(dummy_action, dummy_verify)
    return {"status": "success" if success else "failed", "task": task}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
