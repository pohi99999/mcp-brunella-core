import asyncio, json, os
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

post_bodies = []  # minden POST rest/api-keys választ eltárolunk

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()

        # Csak a POST /rest/api-keys-t figyeljük
        async def handle_response(response):
            url = response.url
            method = response.request.method
            if "rest/api-keys" in url and not url.endswith(".js"):
                try:
                    body = await response.text()
                    print(f"  [RESP] {method} {response.status} {url}")
                    print(f"  [BODY] {body[:500]}")
                    if method == "POST" and response.status in (200, 201):
                        post_bodies.append(body)
                        with open("F:\\mcp-brunella-core\\_br_temp\\api_post_response.txt", "w", encoding="utf-8") as f:
                            f.write(body)
                        print("  ✅ POST RESPONSE MENTVE!")
                except Exception as e:
                    print(f"  [ERR] {e}")

        page.on("response", handle_response)

        # Login
        await page.goto(f"{N8N}/signin", wait_until="domcontentloaded")
        await page.wait_for_selector('input[type="email"]', timeout=15000)
        await page.fill('input[type="email"]', "iszapfalo@gmail.com")
        await page.fill('input[type="password"]', "Iszapfalo13")
        await page.keyboard.press("Enter")
        await page.wait_for_url("**/home/**", timeout=15000)
        print("✅ Login OK")

        # Popup-ok elvadítása
        for _ in range(3):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)

        # Settings > API
        await page.goto(f"{N8N}/settings/api", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        for _ in range(3):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)

        await page.screenshot(path=f"{SS}\\api_before.png")

        # Keresünk meglévő kulcsot - screenshot hogy lássuk a státuszt
        print("2. Aktuális API oldal...")

        # Megpróbáljuk a Create gombot
        create_btn = page.locator('button:has-text("Create")')
        count = await create_btn.count()
        print(f"   Create gomb count: {count}")
        if count == 0:
            # Próbáljuk Add vagy New gombokkal
            for t in ["Add", "New", "Generate"]:
                b = page.locator(f'button:has-text("{t}")')
                c = await b.count()
                print(f"   '{t}' gomb: {c}")

        if count > 0:
            await create_btn.first.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path=f"{SS}\\after_create.png")

            # Dialog keresés
            dialog = page.get_by_role("dialog")
            d_visible = await dialog.count()
            print(f"   Dialog látható: {d_visible}")

            if d_visible > 0:
                # Label input
                inputs = dialog.locator('input')
                in_count = await inputs.count()
                print(f"   Input-ok a dialogban: {in_count}")
                for i in range(in_count):
                    t = await inputs.nth(i).get_attribute("type")
                    v = await inputs.nth(i).input_value()
                    print(f"     input[{i}] type={t} value={v!r}")

                label_input = dialog.locator('input[type="text"]').first
                await label_input.click()
                await label_input.triple_click()
                await label_input.fill("BAS-Final-Key")
                await page.wait_for_timeout(500)

                # Save gomb kattintás - több módszer
                saved = False

                # 1. Módszer: normál click
                save_btn = dialog.locator('button:has-text("Save")')
                s_count = await save_btn.count()
                print(f"   Save gomb count: {s_count}")
                if s_count > 0:
                    try:
                        await save_btn.first.click(force=True, timeout=3000)
                        print("   ✅ Save click (force=True)")
                        saved = True
                    except Exception as e:
                        print(f"   Save force click hiba: {e}")

                if not saved:
                    # 2. Módszer: JS evaluate
                    r = await page.evaluate("""
                        () => {
                            const dlg = document.querySelector('[role="dialog"]');
                            if (!dlg) return 'no dialog';
                            const btns = Array.from(dlg.querySelectorAll('button'));
                            for (const b of btns) {
                                if (b.textContent.trim() === 'Save') {
                                    b.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
                                    return 'clicked: ' + b.textContent.trim();
                                }
                            }
                            return 'no save btn, found: ' + btns.map(b=>b.textContent.trim()).join(', ');
                        }
                    """)
                    print(f"   JS click result: {r}")
                    saved = True

                # Várunk a POST response-ra
                await page.wait_for_timeout(3000)
                await page.screenshot(path=f"{SS}\\after_save_final.png")
                for _ in range(3):
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(400)

        print(f"\n  POST responses captured: {len(post_bodies)}")
        for i, body in enumerate(post_bodies):
            print(f"  [POST {i}] {body[:300]}")

        # Ha van POST response, kinyerjük a kulcsot
        api_key = None
        for body in post_bodies:
            try:
                data = json.loads(body)
                # n8n v1 API: {"data": {"apiKey": "...", ...}} vagy {"apiKey": "..."}
                if "data" in data:
                    d = data["data"]
                    api_key = d.get("apiKey") or d.get("key") or d.get("secret")
                else:
                    api_key = data.get("apiKey") or data.get("key") or data.get("secret")
                if api_key:
                    print(f"\n🔑 API KULCS: {api_key}")
                    break
            except: pass

        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key)
            print("✅ Elmentve: _br_temp\\n8n_api_key.txt")
        else:
            print("\n❌ Kulcs nem kinyerhető a POST válaszból")
            print("   Nézd meg: api_post_response.txt")
            print("   és: after_save_final.png")

        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
