import asyncio, json, os, urllib.request, urllib.error
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

async def login(page):
    print("Megnyitás: /signin")
    await page.goto(f"{N8N}/signin", wait_until="domcontentloaded")
    await page.wait_for_selector('input[type="email"]', timeout=15000)
    await page.wait_for_timeout(1000)
    
    await page.screenshot(path=f"{SS}\\01_login_form.png")
    print("  Email kitöltés...")
    await page.fill('input[type="email"]', "iszapfalo@gmail.com")
    await page.wait_for_timeout(300)
    print("  Jelszó kitöltés...")
    await page.fill('input[type="password"]', "Iszapfalo13")
    await page.wait_for_timeout(500)
    await page.screenshot(path=f"{SS}\\02_login_filled.png")
    
    print("  Enter küldés...")
    await page.keyboard.press("Enter")
    
    # Várjunk URL változásra max 15mp-ig
    try:
        await page.wait_for_url("**/home/workflows**", timeout=15000)
        print(f"✅ Bejelentkezés OK: {page.url}")
        return True
    except:
        await page.screenshot(path=f"{SS}\\03_login_fail.png")
        print(f"  URL: {page.url}")
        # Ha még /signin: próbáljunk gombra kattintani
        try:
            btn = page.locator('button').filter(has_text="Sign")
            if await btn.count() > 0:
                print("  Gomb kattintás...")
                await btn.first.click()
                await page.wait_for_url("**/home/**", timeout=10000)
                print(f"✅ Gombbal OK: {page.url}")
                return True
        except:
            pass
        print(f"❌ Login fail. URL: {page.url}")
        return False

async def get_api_key(page):
    print("\n--- Settings > API ---")
    await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    await page.screenshot(path=f"{SS}\\04_settings_api.png")
    
    content = await page.inner_text("body")
    print(f"  Oldal tartalom (300): {content[:300]}")
    
    # Gomb keresése
    for txt in ["Create API key", "Add first API key", "Create", "Generate"]:
        btns = page.locator(f'button:has-text("{txt}")')
        if await btns.count() > 0:
            print(f"  Kattintás: '{txt}'")
            await btns.first.click()
            await page.wait_for_timeout(3000)
            await page.screenshot(path=f"{SS}\\05_api_created.png")
            break
    
    # Kulcs kinyerése
    for sel in ['input[type="text"]', 'input[readonly]', 'textarea', '[class*="key"]']:
        els = page.locator(sel)
        n = await els.count()
        for i in range(n):
            try:
                val = await els.nth(i).input_value() if sel.startswith("input") or sel.startswith("textarea") else await els.nth(i).inner_text()
                val = val.strip()
                if len(val) > 15 and not val.startswith("http") and "@" not in val:
                    print(f"  ✅ Kulcs: {val[:30]}...")
                    return val
            except:
                continue
    
    print("  ❌ Kulcs nem található")
    return None

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        
        ok = await login(page)
        if not ok:
            input("Login sikertelen - nézd meg a böngészőt, majd ENTER")
            await browser.close()
            return
        
        api_key = await get_api_key(page)
        
        if api_key:
            # API teszt
            try:
                req = urllib.request.Request(
                    f"{N8N}/api/v1/workflows?limit=5",
                    headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"\n✅ API működik! {len(wfs)} workflow találva")
                    with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                        f.write(api_key)
                    print("  Elmentve: _br_temp\\n8n_api_key.txt")
            except Exception as e:
                print(f"  API hiba: {e}")
        
        input("\nEnter a bezáráshoz (nézd meg a screenshotokat!)")
        await browser.close()

asyncio.run(main())
