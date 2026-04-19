import asyncio, json, os
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
os.makedirs(SS, exist_ok=True)

post_bodies = []

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome")
        ctx = await browser.new_context(viewport={"width":1440,"height":900})
        page = await ctx.new_page()

        async def handle_response(response):
            url = response.url
            method = response.request.method
            if "rest/api-keys" in url and not url.endswith(".js"):
                try:
                    body = await response.text()
                    print(f"  [RESP] {method} {response.status} {url}")
                    print(f"  [BODY] {body[:600]}")
                    if method == "POST" and response.status in (200, 201):
                        post_bodies.append(body)
                        with open("F:\\mcp-brunella-core\\_br_temp\\api_post_response.txt", "w", encoding="utf-8") as f:
                            f.write(body)
                        print("  *** POST RESPONSE MENTVE ***")
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
        print("Login OK")

        for _ in range(3):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)

        await page.goto(f"{N8N}/settings/api", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        for _ in range(3):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)

        await page.screenshot(path=f"{SS}\\api_v3_before.png")

        # Create kattintás
        create_btn = page.locator('button:has-text("Create")')
        await create_btn.first.click()
        await page.wait_for_timeout(2000)

        dialog = page.get_by_role("dialog")
        d_count = await dialog.count()
        print(f"Dialog count: {d_count}")

        if d_count > 0:
            # Label kitöltés - fill() elég, triple_click nem kell
            label_input = dialog.locator('input[type="text"]').first
            await label_input.click()
            await label_input.fill("BAS-Final-Key-2")
            await page.wait_for_timeout(500)
            val = await label_input.input_value()
            print(f"Label value: {val!r}")

            await page.screenshot(path=f"{SS}\\api_v3_filled.png")

            # Save kattintás - force=True
            save_btn = dialog.locator('button:has-text("Save")')
            s_count = await save_btn.count()
            print(f"Save button count: {s_count}")

            if s_count > 0:
                await save_btn.first.click(force=True)
                print("Save click OK (force)")
            else:
                # JS click fallback
                r = await page.evaluate("""() => {
                    const dlg = document.querySelector('[role="dialog"]');
                    if (!dlg) return 'no dialog';
                    const btns = Array.from(dlg.querySelectorAll('button'));
                    const save = btns.find(b => b.textContent.trim() === 'Save');
                    if (save) { save.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); return 'JS clicked'; }
                    return 'no save, btns: ' + btns.map(b => b.textContent.trim()).join('|');
                }""")
                print(f"JS fallback: {r}")

            # Várunk POST response-ra
            await page.wait_for_timeout(4000)
            await page.screenshot(path=f"{SS}\\api_v3_after.png")
            for _ in range(3):
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(400)

        print(f"\nPOST responses: {len(post_bodies)}")

        # API kulcs kinyerés
        api_key = None
        for body in post_bodies:
            try:
                data = json.loads(body)
                d = data.get("data", data)
                api_key = d.get("apiKey") or d.get("key") or d.get("secret") or d.get("token")
                if api_key:
                    print(f"API KULCS: {api_key}")
                    break
            except: pass

        if api_key:
            with open("F:\\mcp-brunella-core\\_br_temp\\n8n_api_key.txt", "w") as f:
                f.write(api_key.strip())
            print("Elmentve: n8n_api_key.txt")
        else:
            if post_bodies:
                print(f"POST body volt de nincs kulcs: {post_bodies[0][:300]}")
            else:
                print("Nincs POST response - Save nem sult el!")
                print("Nézd meg: api_v3_filled.png és api_v3_after.png")

        input("\nENTER a bezáráshoz...")
        await browser.close()

asyncio.run(main())
