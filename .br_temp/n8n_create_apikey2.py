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
        
        print("1. Settings > API...")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        
        print("2. Create kattintás...")
        await page.locator('button:has-text("Create")').first.click()
        await page.wait_for_timeout(2000)
        
        # Dialog lokátor
        dialog = page.get_by_role("dialog")
        await dialog.wait_for(state="visible", timeout=5000)
        
        print("3. Label kitöltés a dialógon belül...")
        label_input = dialog.locator('input[type="text"]:not([readonly])').first
        await label_input.fill("BAS-Automation-2026")
        await page.wait_for_timeout(500)
        
        print("4. Save kattintás a dialógon belül...")
        save_btn = dialog.get_by_role("button").filter(has_text="Save")
        if await save_btn.count() == 0:
            # Fallback: primary button a dialógban
            save_btn = dialog.locator('button[class*="primary"], button[class*="_primary"]').first
        await save_btn.first.click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f"{SS}\\after_save.png")
        
        print("5. API kulcs keresése...")
        # Az összes input + textContent
        result = await page.evaluate("""
            () => {
                const els = document.querySelectorAll('input, code, pre, [class*="key"], [class*="token"]');
                return Array.from(els).map(el => ({
                    tag: el.tagName, 
                    val: (el.value || el.textContent || '').trim(),
                    cls: el.className ? el.className.substring(0,60) : ''
                })).filter(x => x.val.length > 15 && x.val.length < 200 
                              && !x.val.includes('\n') && !x.val.includes('http')
                              && !x.val.includes('@'));
            }
        """)
        
        api_key = None
        for item in result:
            val = item['val'].strip()
            if len(val) > 20 and ' ' not in val:
                api_key = val
                print(f"   🔑 Kulcs: {val[:50]}...")
                break
        
        if not api_key:
            # Modal teljes szöveg
            modal_text = await page.evaluate("""
                () => {
                    const d = document.querySelector('[role="dialog"]');
                    return d ? d.innerText : 'nincs dialog';
                }
            """)
            print(f"   Modal szöveg:\n{modal_text[:600]}")
            # Összes input value részletesen
            vals = await page.evaluate("""
                () => Array.from(document.querySelectorAll('input')).map(el => ({
                    type: el.type, val: el.value, ro: el.readOnly, id: el.id
                }))
            """)
            print("   Inputok:")
            for v in vals:
                print(f"     {v['type']} ro={v['ro']} val='{v['val']}' id={v['id']}")
        
        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print(f"\n✅ ELMENTVE!")
            try:
                req = urllib.request.Request(
                    f"{N8N}/api/v1/workflows?limit=20",
                    headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"✅ API OK! {len(wfs)} workflow")
                    for w in wfs:
                        print(f"   {w['id']} | {w['name']}")
            except Exception as e:
                print(f"❌ API hiba: {e}")
        
        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
