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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)
