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
    await page.fill('input[type="password"]', "Iszapfalo13")
    await page.wait_for_timeout(500)
    await page.keyboard.press("Enter")
    await page.wait_for_url("**/home/**", timeout=15000)
    print("✅ Login OK")

async def dismiss_popups(page):
    """Minden popup/modal bezárása Escape-pel"""
    for _ in range(3):
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()
        await login(page)

        # Popupok bezárása
        await dismiss_popups(page)

        print("1. Settings > API...")
        await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        await dismiss_popups(page)
        await page.wait_for_timeout(500)
        await page.screenshot(path=f"{SS}\\api_clean.png")

        print("2. Create kattintás...")
        await page.locator('button:has-text("Create")').first.click()
        await page.wait_for_timeout(1500)

        # Ha "We've been busy" popup jelenik meg, zárjuk be
        body = await page.evaluate("() => document.body.innerText")
        if "busy" in body.lower() or "We've been" in body:
            print("  ⚠️ Popup észlelve, Escape...")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(1000)
            await page.locator('button:has-text("Create")').first.click()
            await page.wait_for_timeout(1500)

        dialog = page.get_by_role("dialog")
        await dialog.wait_for(state="visible", timeout=8000)
        print("3. Dialog megnyílt")

        # Label kitöltés
        label_input = dialog.locator('input[type="text"]:not([readonly])').first
        await label_input.click()
        await label_input.fill("BAS-Auto-Key")
        await page.wait_for_timeout(400)

        # Save - JS click a dialógon belül
        print("4. Save...")
        await page.evaluate("""
            () => {
                const dlg = document.querySelector('[role="dialog"]');
                if (!dlg) return;
                const btns = dlg.querySelectorAll('button');
                for (const b of btns) {
                    if (b.innerText.trim() === 'Save') { b.click(); return; }
                }
                // Fallback: utolsó primary gomb
                const primary = dlg.querySelectorAll('button[class*="primary"]');
                if (primary.length) primary[primary.length-1].click();
            }
        """)

        # Várjuk a választ - figyelve "We've been busy" popupot
        await page.wait_for_timeout(1500)
        body2 = await page.evaluate("() => document.body.innerText")
        if "busy" in body2.lower():
            print("  ⚠️ 'We've been busy' popup → Escape")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(800)

        await page.screenshot(path=f"{SS}\\after_save2.png")

        # Kulcs keresése az összes inputban ÉS oldalon
        print("5. Kulcs keresése...")
        vals = await page.evaluate("""
            () => {
                const result = [];
                document.querySelectorAll('input').forEach(el => {
                    if (el.value && el.value.length > 10) result.push({src:'input', v:el.value, ro:el.readOnly});
                });
                document.querySelectorAll('code, pre, [class*="copy"]').forEach(el => {
                    const t = el.textContent.trim();
                    if (t.length > 15 && t.length < 150) result.push({src:el.tagName, v:t, ro:false});
                });
                return result;
            }
        """)
        print("  Értékek:")
        for v in vals:
            print(f"    [{v['src']}] ro={v['ro']} → {v['v'][:70]}")

        # n8n API kulcs formátum: n8n_api_xxxx vagy hosszú string
        api_key = None
        for v in vals:
            val = v['v'].strip()
            if len(val) > 25 and ' ' not in val and '@' not in val and 'http' not in val:
                if val not in ('BAS-Auto-Key', '30 days', 'on'):
                    api_key = val
                    print(f"\n  🔑 API KULCS: {val}")
                    break

        if not api_key:
            # Navigáljunk vissza - hátha a listában van
            print("  Lista ellenőrzés...")
            await page.goto(f"{N8N}/settings/api", wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            await dismiss_popups(page)
            await page.screenshot(path=f"{SS}\\api_list.png")
            page_text = await page.evaluate("() => document.body.innerText")
            print(f"  Oldal (400):\n{page_text[:400]}")

        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print("✅ ELMENTVE!")
            req = urllib.request.Request(f"{N8N}/api/v1/workflows?limit=20",
                headers={"X-N8N-API-KEY": api_key, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                wfs = data.get("data", [])
                print(f"✅ API OK: {len(wfs)} workflow")
                for w in wfs:
                    print(f"   {w['id']} | {w['name']} | active={w['active']}")

        input("\nENTER bezáráshoz...")
        await browser.close()

asyncio.run(main())
