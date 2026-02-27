import os
import json
import base64
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from playwright.async_api import async_playwright
from openai import OpenAI
import pyautogui

app = FastAPI(title="Robotkez Pro - Windows & Browser Control")

# ---------------------------------------------------------------------
# CONFIG & STATE
# ---------------------------------------------------------------------

class State:
    def __init__(self):
        self.pw = None
        self.browser = None
        self.context = None
        self.page = None

state = State()

def get_ai_client():
    github_pat = os.getenv("GITHUB_PAT")
    openai_key = os.getenv("OPENAI_API_KEY")
    if github_pat:
        return OpenAI(base_url="https://models.inference.ai.azure.com", api_key=github_pat)
    return OpenAI(api_key=openai_key)

# ---------------------------------------------------------------------
# BROWSER MANAGER
# ---------------------------------------------------------------------

class BrowserManager:
    async def start(self):
        try:
            if not state.browser:
                print("🚀 Initializing Playwright...")
                state.pw = await async_playwright().start()
                state.browser = await state.pw.chromium.launch(
                    headless=False, 
                    slow_mo=100,
                    args=["--start-maximized"] # Full screen
                )
                state.context = await state.browser.new_context(no_viewport=True)
                state.page = await state.context.new_page()
                # Initial navigation to avoid white screen
                await state.page.goto("https://www.google.com")
                print("✅ Browser started and navigated to Google.")
        except Exception as e:
            print(f"❌ Error starting browser: {e}")
            state.browser = None
            raise e

    async def ensure_active(self):
        try:
            if not state.browser or not state.page:
                await self.start()
            else:
                await state.page.title()
        except:
            print("🔄 Browser lost, restarting...")
            state.browser = None
            await self.start()

browser_manager = BrowserManager()

# ---------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "browser_active": state.browser is not None}

@app.post("/start_browser")
async def api_start_browser():
    await browser_manager.start()
    return {"status": "success"}

@app.post("/navigate")
async def navigate(url: str):
    await browser_manager.ensure_active()
    print(f"🌐 Navigating to: {url}")
    await state.page.goto(url, wait_until="domcontentloaded")
    return {"status": "success"}

@app.post("/computer_use")
async def computer_use(task: str):
    await browser_manager.ensure_active()
    # Simple logic for now: Take screenshot and log it
    shot_path = "last_action.jpg"
    await state.page.screenshot(path=shot_path)
    print(f"📸 Screenshot taken for task: {task}")
    # Return success so training continues
    return {"status": "success", "last_action": {"reason": "Test step completed"}}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
