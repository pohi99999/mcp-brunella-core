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
    print("✅ Login OK")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        await login(page)

        # Meglévő API kulcs ellenőrzése előbb
        print("1. Settings > API...")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=f"{SS}\\api_page_start.png")

        # Van-e már létrehozott kulcs a listában?
        existing = await page.evaluate("() => Array.from(document.querySelectorAll('input, code, td, [class*=\"key\"]')).map(e=>(e.value||e.textContent||'').trim()).filter(v=>v.length>20 && v.length<120 && !v.includes(' ') && !v.includes('@') && !v.includes('http') && !v.includes('Create'))")
        if existing:
            print(f"  Meglévő kulcs: {existing[0][:40]}...")
            api_key = existing[0]
        else:
            print("2. Create kattintás...")
            await page.locator('button:has-text("Create")').first.click()
            await page.wait_for_timeout(2000)
            dialog = page.get_by_role("dialog")
            await dialog.wait_for(state="visible", timeout=5000)

            print("3. Label kitöltés...")
            label_input = dialog.locator('input[type="text"]:not([readonly])').first
            await label_input.click()
            await label_input.fill("BAS-Automation-2026")
            await page.wait_for_timeout(500)

            print("4. Save kattintás (JS click)...")
            # JS click elkerüli a pointer events blokkolást
            await page.evaluate("() => { const btns = document.querySelectorAll('[role=\"dialog\"] button'); for(const b of btns){ if(b.textContent.trim()==='Save'){b.click();break;} } }")
            await page.wait_for_timeout(3000)
            await page.screenshot(path=f"{SS}\\after_save.png")

            print("5. Kulcs keresése...")
            # Egyszerű JS - minden input value
            vals = await page.evaluate("() => Array.from(document.querySelectorAll('input')).map(e=>({v:e.value,ro:e.readOnly,id:e.id}))")
            print("  Inputok:")
            for v in vals:
                print(f"    id={v['id']} ro={v['ro']} val={v['v'][:60]}")

            # Modal szöveg
            modal_txt = await page.evaluate("() => { const d=document.querySelector('[role=\"dialog\"]'); return d ? d.innerText : 'no dialog'; }")
            print(f"  Modal:\n{modal_txt[:500]}")

            api_key = None
            for v in vals:
                val = v['v'].strip()
                if len(val) > 20 and ' ' not in val and '@' not in val and 'http' not in val:
                    api_key = val
                    print(f"  🔑 Kulcs: {val[:50]}")
                    break

        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print(f"\n✅ MENTVE!")
            try:
                req = urllib.request.Request(f"{N8N}/api/v1/workflows?limit=20", headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    wfs = data.get("data", [])
                    print(f"✅ API OK! {len(wfs)} workflow:")
                    for w in wfs:
                        print(f"   {w['id']} | {w['name']} | active={w['active']}")
            except Exception as e:
                print(f"❌ API hiba: {e}")

        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
