import sys
import json
import asyncio
import base64
import os
from playwright.async_api import async_playwright

# Ensure we use unbuffered stdout for JSON communication
# sys.stdout.reconfigure(encoding='utf-8') # Python 3.7+

async def main():
    async with async_playwright() as p:
        browser = None
        context = None
        page = None

        async def get_page():
            nonlocal browser, context, page
            if not browser:
                # Default to headless unless specified otherwise in env or args
                headless = os.getenv("HEADLESS", "true").lower() == "true"
                browser = await p.chromium.launch(headless=headless, args=['--no-sandbox', '--disable-setuid-sandbox'])
                context = await browser.new_context(viewport={'width': 1280, 'height': 720})
                page = await context.new_page()
            return page

        loop = asyncio.get_running_loop()

        while True:
            try:
                line = await loop.run_in_executor(None, sys.stdin.readline)
                if not line:
                    break

                cmd = json.loads(line)
                action = cmd.get("action")
                result = {"status": "error", "message": "Unknown action"}

                if action == "launch":
                    await get_page() # Initializes browser
                    result = {"status": "success", "message": "Browser launched"}

                elif action == "navigate":
                    pg = await get_page()
                    url = cmd.get("url")
                    if url:
                        await pg.goto(url)
                        result = {"status": "success", "url": pg.url}
                    else:
                        result = {"status": "error", "message": "URL missing"}

                elif action == "click":
                    pg = await get_page()
                    selector = cmd.get("selector")
                    if selector:
                        try:
                            await pg.click(selector, timeout=5000)
                            result = {"status": "success", "message": f"Clicked {selector}"}
                        except Exception as e:
                            result = {"status": "error", "message": str(e)}
                    else:
                        result = {"status": "error", "message": "Selector missing"}

                elif action == "type":
                    pg = await get_page()
                    selector = cmd.get("selector")
                    text = cmd.get("text")
                    if selector and text is not None:
                        try:
                            await pg.fill(selector, text, timeout=5000)
                            result = {"status": "success", "message": f"Typed into {selector}"}
                        except Exception as e:
                            result = {"status": "error", "message": str(e)}
                    else:
                        result = {"status": "error", "message": "Selector or text missing"}

                elif action == "screenshot":
                    pg = await get_page()
                    try:
                        screenshot_bytes = await pg.screenshot(type='png')
                        b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                        result = {"status": "success", "screenshot": b64}
                    except Exception as e:
                        result = {"status": "error", "message": str(e)}

                elif action == "content":
                    pg = await get_page()
                    content = await pg.content()
                    result = {"status": "success", "content": content}

                elif action == "close":
                    if browser:
                        await browser.close()
                        browser = None
                        page = None
                        context = None
                    result = {"status": "success", "message": "Browser closed"}

                print(json.dumps(result), flush=True)

            except json.JSONDecodeError:
                print(json.dumps({"status": "error", "message": "Invalid JSON"}), flush=True)
            except Exception as e:
                print(json.dumps({"status": "error", "message": str(e)}), flush=True)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
