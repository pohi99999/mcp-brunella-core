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
    print(f"✅ Login: {page.url}")

async def dump_inputs(page, label=""):
    vals = await page.evaluate("""() => Array.from(document.querySelectorAll('input, textarea')).map(el => ({
        type: el.type, value: el.value, readonly: el.readOnly, placeholder: el.placeholder,
        id: el.id, name: el.name, cls: el.className.substring(0,50)
    }))""")
    print(f"\n  [INPUTS {label}]")
    for v in vals:
        if v['value'] and len(v['value']) > 5:
            print(f"    type={v['type']} readonly={v['readonly']} val={v['value'][:60]} id={v['id']}")
    return vals

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        
        await login(page)
        
        print("\n--- Settings > API ---")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        # Meglévő inputok
        before = await dump_inputs(page, "ELŐTTE")
        
        await page.screenshot(path=f"{SS}\\04_settings_api.png")
        
        # Klikk a "Create API key" gombra
        for txt in ["Create API key", "Add first API key", "Create"]:
            btns = page.locator(f'button:has-text("{txt}")')
            if await btns.count() > 0 and await btns.first.is_visible():
                print(f"\n  Kattintás: '{txt}'")
                await btns.first.click()
                await page.wait_for_timeout(3000)
                await page.screenshot(path=f"{SS}\\05_modal.png")
                break
        
        # Inputok a modal megnyitása után
        after = await dump_inputs(page, "MODAL UTÁN")
        
        # Keressük az API kulcsot: hosszú alfanum string, NEM email, NEM URL
        api_key = None
        for v in after:
            val = v.get('value', '').strip()
            if (len(val) > 20 and 
                not val.startswith('http') and 
                '@' not in val and
                ' ' not in val):
                api_key = val
                print(f"\n  🔑 Lehetséges API kulcs: {val[:40]}...")
                break
        
        # Ha nincs input value, próbáljuk a DOM text tartalmát
        if not api_key:
            print("\n  Input nem találta, kísérlet DOM szövegből...")
            modal_text = await page.evaluate("""
                () => {
                    const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"], [class*="dialog"]');
                    return modal ? modal.innerText : document.body.innerText;
                }
            """)
            print(f"  Modal szöveg (500): {modal_text[:500]}")
        
        if api_key:
            print(f"\n✅ API KEY: {api_key}")
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print("  Mentve: _br_temp\\n8n_api_key.txt")
            
            # Teszt
            try:
                req = urllib.request.Request(
                    f"{N8N}/api/v1/workflows?limit=5",
                    headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read())
                    print(f"  API teszt: ✅ {len(data.get('data',[]))} workflow")
            except Exception as e:
                print(f"  API teszt hiba: {e}")
        
        input("\n  ENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
