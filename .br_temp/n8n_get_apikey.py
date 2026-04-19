import asyncio, json, time, os
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

async def login(page):
    await page.goto(f"{N8N}/signin", wait_until="networkidle")
    await page.wait_for_selector('input[type="email"]', timeout=10000)
    await page.fill('input[type="email"]', "iszapfalo@gmail.com")
    await page.fill('input[type="password"]', "Iszapfalo13")
    await page.wait_for_timeout(500)
    await page.locator('button:has-text("Sign in")').click()
    await page.wait_for_load_state("networkidle")
    print(f"Login URL: {page.url}")
    assert "signin" not in page.url, "BEJELENTKEZÉS SIKERTELEN"
    print("✅ Bejelentkezve")

async def get_or_create_api_key(page):
    """Settings > API oldalon API kulcs létrehozása kattintással"""
    print("\n--- API kulcs lekérése ---")
    await page.goto(f"{N8N}/settings/api", wait_until="networkidle")
    await page.wait_for_timeout(2000)
    await page.screenshot(path=f"{SS}\\settings_api.png")
    
    # Ellenőrzés: van-e már kulcs?
    existing = page.locator('[class*="api-key"], [class*="apiKey"], input[readonly], .n8n-input')
    count = await existing.count()
    print(f"  Elemek száma: {count}")
    
    # Próbáljuk kinyerni a meglévő kulcsot
    page_text = await page.inner_text("body")
    if "n8n_api" in page_text.lower():
        print("  Van meglévő API kulcs")
    
    # "Create API Key" / "Add first API key" gomb keresése
    for btn_text in ["Create API key", "Add first API key", "Create", "Generate", "New API Key"]:
        btn = page.locator(f'button:has-text("{btn_text}")')
        if await btn.count() > 0 and await btn.first.is_visible():
            print(f"  Kattintás: '{btn_text}'")
            await btn.first.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SS}\\api_key_modal.png")
            break
    
    # Kulcs kinyerése a modalból vagy az oldalból
    await page.wait_for_timeout(1000)
    api_key = None
    
    # Próbáljuk megtalálni az input mezőt a kulccsal
    for sel in ['input[readonly]', 'input[type="text"][value]', '.n8n-input input', 'code', 'pre']:
        els = page.locator(sel)
        n = await els.count()
        for i in range(n):
            val = await els.nth(i).get_attribute("value") or await els.nth(i).inner_text()
            if val and len(val) > 20 and ("n8n_api_" in val or "n8n_" in val or len(val) > 30):
                api_key = val.strip()
                print(f"  ✅ API kulcs: {api_key[:20]}...")
                break
        if api_key: break
    
    if not api_key:
        print("  ❌ Nem sikerült API kulcsot kinyerni, screenshot: settings_api.png")
        full_text = await page.inner_text("body")
        print(f"  Oldal tartalma (első 500 kar): {full_text[:500]}")
    
    return api_key

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome", slow_mo=500)
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        
        await login(page)
        api_key = await get_or_create_api_key(page)
        
        if api_key:
            # Teszteljük az API kulcsot
            import urllib.request
            req = urllib.request.Request(
                f"{N8N}/api/v1/workflows?limit=20",
                headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"\n✅ API KEY MŰKÖDIK! {len(wfs)} workflow:")
                    for w in wfs:
                        print(f"  ID={w['id']} | {w['name']} | active={w['active']}")
                    with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                        f.write(api_key)
                    print("\n  API kulcs elmentve: _br_temp\\n8n_api_key.txt")
            except Exception as e:
                print(f"  API teszt hiba: {e}")
        
        input("Nyomj ENTER-t a bezáráshoz...")
        await browser.close()

asyncio.run(main())
