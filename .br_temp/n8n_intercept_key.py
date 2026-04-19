import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

captured_key = None

async def login(page):
    await page.goto(f"{N8N}/signin", wait_until="domcontentloaded")
    await page.wait_for_selector('input[type="email"]', timeout=15000)
    await page.wait_for_timeout(600)
    await page.fill('input[type="email"]', "iszapfalo@gmail.com")
    await page.fill('input[type="password"]', "Iszapfalo13")
    await page.wait_for_timeout(400)
    await page.keyboard.press("Enter")
    await page.wait_for_url("**/home/**", timeout=15000)
    print("✅ Login OK")

async def main():
    global captured_key
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()

        # Hálózati response interceptálás
        async def handle_response(response):
            global captured_key
            url = response.url
            if "api-key" in url.lower() or "apikey" in url.lower() or ("api" in url and "key" in url):
                try:
                    body = await response.text()
                    print(f"  [NET] {response.status} {url}")
                    print(f"  [NET] body: {body[:200]}")
                    if response.status in (200, 201):
                        try:
                            data = json.loads(body)
                            # Keressük a kulcsot a JSON-ban
                            def find_key(obj, depth=0):
                                if depth > 5: return None
                                if isinstance(obj, str) and len(obj) > 20 and ' ' not in obj:
                                    return obj
                                if isinstance(obj, dict):
                                    for k, v in obj.items():
                                        if k in ('apiKey', 'key', 'token', 'value', 'secret'):
                                            if isinstance(v, str) and len(v) > 15:
                                                return v
                                        r = find_key(v, depth+1)
                                        if r: return r
                                if isinstance(obj, list):
                                    for item in obj:
                                        r = find_key(item, depth+1)
                                        if r: return r
                                return None
                            k = find_key(data)
                            if k:
                                captured_key = k
                                print(f"  🔑 KULCS INTERCEPTÁLVA: {k[:50]}...")
                        except: pass
                except: pass

        page.on("response", handle_response)
        await login(page)

        # Popup elutasítás
        for _ in range(3):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(400)

        print("1. Settings > API...")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        for _ in range(2):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(400)

        print("2. Create kattintás...")
        await page.locator('button:has-text("Create")').first.click()
        await page.wait_for_timeout(1500)

        dialog = page.get_by_role("dialog")
        try:
            await dialog.wait_for(state="visible", timeout=5000)
        except:
            print("  Nincs dialog - popup zárás után újra")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)
            await page.locator('button:has-text("Create")').first.click()
            await page.wait_for_timeout(1500)
            await dialog.wait_for(state="visible", timeout=5000)

        print("3. Label + Save...")
        label_input = dialog.locator('input[type="text"]:not([readonly])').first
        await label_input.fill("BAS-Key-Final")
        await page.wait_for_timeout(400)

        # Save JS click
        await page.evaluate("""
            () => {
                const dlg = document.querySelector('[role="dialog"]');
                if (!dlg) return false;
                for (const b of dlg.querySelectorAll('button')) {
                    if (b.innerText.trim() === 'Save') { b.click(); return true; }
                }
                const primary = dlg.querySelector('button[class*="_primary"]');
                if (primary) { primary.click(); return true; }
                return false;
            }
        """)

        # Várunk és zárjuk a popupot
        await page.wait_for_timeout(2000)
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{SS}\\final_after_save.png")

        print(f"\n  Elfogott kulcs: {captured_key}")

        if captured_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(captured_key)
            print("✅ API KULCS ELMENTVE!")
            # Teszt
            try:
                req = urllib.request.Request(f"{N8N}/api/v1/workflows?limit=20",
                    headers={"X-N8N-API-KEY": captured_key, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"✅ API TESZT OK: {len(wfs)} workflow")
                    for w in wfs:
                        print(f"   {w['id']} | {w['name']} | active={w['active']}")
                    with open("F:\\mcp-brunella-core\\_br_temp\\n8n_workflows.json", "w", encoding="utf-8") as f:
                        json.dump(wfs, f, indent=2, ensure_ascii=False)
                    print("   Elmentve: _br_temp\\n8n_workflows.json")
            except Exception as e:
                print(f"❌ API teszt hiba: {e}")
        else:
            print("❌ Kulcs nem interceptálva")
            print("  Nézd meg a screenshotot: final_after_save.png")

        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
