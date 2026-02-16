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
                # Check ROBOTKEZ_HEADLESS first, fallback to HEADLESS
                # Default: true (headless = no browser window visible)
                # Set ROBOTKEZ_HEADLESS=false in .env to see the browser window!
                robotkez_headless = os.getenv("ROBOTKEZ_HEADLESS", os.getenv("HEADLESS", "true"))
                headless = robotkez_headless.lower() == "true"

                # Get viewport settings from env or use defaults
                viewport_width = int(os.getenv("ROBOTKEZ_VIEWPORT_WIDTH", "1280"))
                viewport_height = int(os.getenv("ROBOTKEZ_VIEWPORT_HEIGHT", "720"))

                print(f"[Robotkéz] Böngésző indítás: headless={headless}, viewport={viewport_width}x{viewport_height}", file=sys.stderr)

                browser = await p.chromium.launch(headless=headless, args=['--no-sandbox', '--disable-setuid-sandbox'])
                context = await browser.new_context(viewport={'width': viewport_width, 'height': viewport_height})
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

                # ==================== NEW ACTIONS (RobotkezV2) ====================

                elif action == "scroll":
                    pg = await get_page()
                    direction = cmd.get("direction", "down")
                    amount = cmd.get("amount", 100)

                    try:
                        if direction == "down":
                            await pg.evaluate(f"window.scrollBy(0, {amount})")
                        elif direction == "up":
                            await pg.evaluate(f"window.scrollBy(0, -{amount})")
                        elif direction == "left":
                            await pg.evaluate(f"window.scrollBy(-{amount}, 0)")
                        elif direction == "right":
                            await pg.evaluate(f"window.scrollBy({amount}, 0)")
                        else:
                            result = {"status": "error", "message": f"Invalid direction: {direction}"}
                            print(json.dumps(result), flush=True)
                            continue

                        result = {"status": "success", "message": f"Scrolled {direction} by {amount}px"}
                    except Exception as e:
                        result = {"status": "error", "message": str(e)}

                elif action == "wait":
                    pg = await get_page()
                    selector = cmd.get("selector")
                    timeout = cmd.get("timeout", 5000)

                    if selector:
                        try:
                            await pg.wait_for_selector(selector, timeout=timeout)
                            result = {"status": "success", "message": f"Element {selector} is visible"}
                        except Exception as e:
                            result = {"status": "error", "message": f"Timeout waiting for {selector}: {str(e)}"}
                    else:
                        result = {"status": "error", "message": "Selector missing"}

                elif action == "extract":
                    pg = await get_page()
                    selector = cmd.get("selector")
                    extract_type = cmd.get("type", "text")
                    attribute = cmd.get("attribute")

                    if not selector:
                        result = {"status": "error", "message": "Selector missing"}
                    else:
                        try:
                            elements = await pg.query_selector_all(selector)

                            if extract_type == "text":
                                data = []
                                for el in elements:
                                    text = await el.inner_text()
                                    data.append(text)

                            elif extract_type == "attribute":
                                if not attribute:
                                    result = {"status": "error", "message": "Attribute name missing"}
                                    print(json.dumps(result), flush=True)
                                    continue
                                data = []
                                for el in elements:
                                    attr_value = await el.get_attribute(attribute)
                                    data.append(attr_value)

                            elif extract_type == "html":
                                data = []
                                for el in elements:
                                    html = await el.inner_html()
                                    data.append(html)

                            else:
                                result = {"status": "error", "message": f"Invalid extract type: {extract_type}"}
                                print(json.dumps(result), flush=True)
                                continue

                            result = {"status": "success", "data": data, "count": len(data)}
                        except Exception as e:
                            result = {"status": "error", "message": str(e)}

                elif action == "press":
                    pg = await get_page()
                    key = cmd.get("key")
                    if key:
                        try:
                            await pg.keyboard.press(key)
                            result = {"status": "success", "message": f"Pressed {key}"}
                        except Exception as e:
                            result = {"status": "error", "message": str(e)}
                    else:
                        result = {"status": "error", "message": "Key missing"}

                # ==================== END NEW ACTIONS ====================

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
    # Windows fix: Use ProactorEventLoop (default in Python 3.8+)
    # Playwright requires ProactorEventLoop on Windows
    if sys.platform == 'win32':
        # For Python 3.8+, ProactorEventLoop is default - no need to set
        # WindowsSelectorEventLoopPolicy causes issues with Playwright subprocess
        pass

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
