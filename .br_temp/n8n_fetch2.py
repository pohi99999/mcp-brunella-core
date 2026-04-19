import asyncio, json
from playwright.async_api import async_playwright

N8N = "https://iszapfalo.app.n8n.cloud"
SCREENSHOTS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome", slow_mo=400)
        ctx = await browser.new_context(viewport={"width":1366,"height":768})
        page = await ctx.new_page()

        # Bejelentkezés
        await page.goto(f"{N8N}/signin", wait_until="networkidle")
        await page.wait_for_selector('input[type="email"]', timeout=10000)
        await page.fill('input[type="email"]', "iszapfalo@gmail.com")
        await page.fill('input[type="password"]', "Iszapfalo13")
        await page.wait_for_timeout(500)
        # Keressük a submit gombot több selectorral
        for sel in ['button:has-text("Sign in")', 'button:has-text("Log in")', '[type="submit"]', 'button']:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    print(f"Kattintva: {sel}")
                    break
            except: continue
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        print(f"URL: {page.url}")
        if "signin" in page.url:
            await page.screenshot(path=f"{SCREENSHOTS}\\login_fail.png")
            print("SIKERTELEN"); await browser.close(); return
        print("SIKERES bejelentkezés!")

        # In-browser fetch: credentials
        r = await page.evaluate("""async () => {
            const resp = await fetch('/rest/credentials', {credentials:'include'});
            return {ok: resp.ok, status: resp.status, body: await resp.text()};
        }""")
        print(f"\n[CREDENTIALS] status={r['status']}")
        if r['ok']:
            try:
                data = json.loads(r['body'])
                creds = data if isinstance(data, list) else data.get('data', data.get('credentials', []))
                print(f"  {len(creds)} credential:")
                for c in creds:
                    print(f"    ID={c.get('id')} | {c.get('name')} | {c.get('type')}")
            except: print(f"  Raw: {r['body'][:300]}")
        else:
            print(f"  HIBA: {r['body'][:200]}")

        # In-browser fetch: workflows
        r2 = await page.evaluate("""async () => {
            const resp = await fetch('/rest/workflows?limit=20', {credentials:'include'});
            return {ok: resp.ok, status: resp.status, body: await resp.text()};
        }""")
        print(f"\n[WORKFLOWS] status={r2['status']}")
        if r2['ok']:
            try:
                data2 = json.loads(r2['body'])
                wfs = data2 if isinstance(data2, list) else data2.get('data', [])
                print(f"  {len(wfs)} workflow:")
                for w in wfs:
                    print(f"    ID={w.get('id')} | {w.get('name')} | active={w.get('active')}")
            except: print(f"  Raw: {r2['body'][:300]}")
        else:
            print(f"  HIBA: {r2['body'][:200]}")

        await browser.close()

asyncio.run(main())
