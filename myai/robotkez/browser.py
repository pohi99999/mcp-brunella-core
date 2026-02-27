import os
from playwright.async_api import async_playwright, Page, BrowserContext, Browser

class OverlayBrowserManager:
    def __init__(self):
        self.pw = None
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None

    async def start(self):
        if not self.browser:
            print("🚀 Initializing Playwright with Overlay...")
            self.pw = await async_playwright().start()
            self.browser = await self.pw.chromium.launch(
                headless=False,
                args=["--start-maximized"]
            )
            self.context = await self.browser.new_context(no_viewport=True)
            self.page = await self.context.new_page()

            # Inject the overlay script on every new page
            overlay_script_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "build", "overlay", "overlay.bundle.js"
            )
            
            if os.path.exists(overlay_script_path):
                with open(overlay_script_path, "r", encoding="utf-8") as f:
                    script_content = f.read()
                
                await self.context.add_init_script(script_content)
                print("✅ Overlay chat script injected into context.")
            else:
                print(f"⚠️ Overlay script not found at {overlay_script_path}. Run 'npm run build:overlay' or check path.")

            await self.page.goto("https://www.google.com")
            print("✅ Browser started.")

    async def ensure_active(self):
        if not self.browser or not self.page:
            await self.start()
        else:
            try:
                await self.page.title()
            except:
                print("🔄 Browser lost, restarting...")
                self.browser = None
                await self.start()

    async def stop(self):
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.pw:
            await self.pw.stop()
        self.browser = None
        self.context = None
        self.page = None

overlay_browser = OverlayBrowserManager()
