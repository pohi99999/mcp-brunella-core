import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

async def login(page):
    await page.goto(f"{N8N}/signin", wait_until="domcontentloaded")
    await page.wait_for_selector('input[type="email"]', timeout=15000)
    await page.wait_for_timeout(800)
    await page.fill('input[type="email"]', "iszapfalo@gmail.com")
    await page.wait_for_timeout(300)
    await page.fill('input[type="password"]', "Iszapfalo13")
    await page.wait_for_timeout(500)
    await page.keyboard.press("Enter")
    await page.wait_for_url("**/home/**", timeout=15000)
    print(f"✅ Login OK")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        
        await login(page)
        
        # Settings > API
        print("\n1. Settings > API megnyitás...")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        
        # Create gomb
        print("2. 'Create' kattintás...")
        await page.locator('button:has-text("Create")').first.click()
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f"{SS}\\modal_before_label.png")
        
        # Label mező - MINDEN input (readonly nélkül)
        all_inputs = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input')).map((el,i) => ({
                i, type: el.type, value: el.value, readonly: el.readOnly,
                placeholder: el.placeholder, id: el.id, visible: el.offsetParent !== null
            }))
        """)
        print(f"3. Összes input a modalban:")
        for inp in all_inputs:
            print(f"   [{inp['i']}] type={inp['type']} readonly={inp['readonly']} val='{inp['value']}' placeholder='{inp['placeholder']}' id={inp['id']}")
        
        # Label kitöltés: az első NEM readonly szöveges input
        label_filled = False
        for inp in all_inputs:
            if inp['type'] in ('text', '') and not inp['readonly'] and inp['visible']:
                print(f"4. Label kitöltés (index {inp['i']})...")
                await page.evaluate(f"document.querySelectorAll('input')[{inp['i']}].focus()")
                await page.wait_for_timeout(300)
                await page.keyboard.type("BAS-Automation-2026")
                await page.wait_for_timeout(300)
                label_filled = True
                break
        
        if not label_filled:
            # Próba: label szöveg melletti input
            label_input = page.locator('label:has-text("Label") + * input, [placeholder*="abel"], [placeholder*="name"]')
            if await label_input.count() > 0:
                await label_input.first.fill("BAS-Automation-2026")
                label_filled = True
                print("4. Label kitöltve (label selector)")
        
        await page.screenshot(path=f"{SS}\\modal_label_filled.png")
        
        # Save kattintás
        print("5. Save kattintás...")
        save_btn = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]')
        await save_btn.first.click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SS}\\after_save.png")
        
        # Kulcs kinyerése
        print("6. API kulcs keresése...")
        all_vals = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input, textarea, [class*="key"], [class*="token"], code, pre, [data-testid]'))
                .map(el => ({tag: el.tagName, val: el.value || el.textContent || '', cls: el.className.substring(0,60)}))
                .filter(x => x.val.trim().length > 15)
        """)
        
        api_key = None
        for item in all_vals:
            val = item['val'].strip()
            # n8n kulcs formátuma: n8n_api_... vagy hosszú hex/base64
            if ('n8n_api_' in val or (len(val) > 30 and ' ' not in val and '\n' not in val)):
                if not val.startswith('http') and '@' not in val:
                    api_key = val
                    print(f"   🔑 KULCS: {val[:50]}...")
                    break
        
        if not api_key:
            print("   Részletes dump:")
            for item in all_vals[:10]:
                print(f"   {item['tag']}: {item['val'][:80]}")
        
        # Mentés és teszt
        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print(f"\n✅ ELMENTVE: _br_temp\\n8n_api_key.txt")
            
            try:
                req = urllib.request.Request(
                    f"{N8N}/api/v1/workflows?limit=20",
                    headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"✅ API TESZT OK: {len(wfs)} workflow!")
                    for w in wfs:
                        print(f"   {w['id']} | {w['name']} | active={w['active']}")
            except Exception as e:
                print(f"❌ API teszt: {e}")
        
        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
