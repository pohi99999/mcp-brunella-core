import asyncio
import json
from playwright.async_api import async_playwright

N8N_BASE = "https://iszapfalo.app.n8n.cloud"
EMAIL = "iszapfalo@gmail.com"
PASSWORD = "Iszapfalo13"
SCREENSHOTS = "F:\\mcp-brunella-core\\_br_temp\\screenshots"
AIRTABLE_BASE_ID = "appU3xQMuAmpmmCEy"
PARTNEREK_TABLE_ID = "tblCR2aIaM4aNmsSm"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, channel="chrome", slow_mo=300)
        ctx = await browser.new_context(viewport={"width":1366,"height":768})
        page = await ctx.new_page()

        # --- Bejelentkezés ---
        await page.goto(f"{N8N_BASE}/signin", wait_until="networkidle")
        await page.fill('input[type="email"]', EMAIL)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        print(f"Login URL: {page.url}")
        if "signin" in page.url:
            print("SIKERTELEN BEJELENTKEZÉS"); await browser.close(); return

        print("✅ Bejelentkezve!")

        # --- In-browser fetch: Credentials ---
        print("\n[A] Credentials lekérése (in-browser)...")
        creds = await page.evaluate("""
            async () => {
                const r = await fetch('/rest/credentials', {credentials:'include'});
                const text = await r.text();
                return {status: r.status, body: text.substring(0, 3000)};
            }
        """)
        print(f"  Status: {creds['status']}")
        print(f"  Body: {creds['body'][:500]}")

        # --- In-browser fetch: Workflows ---
        print("\n[B] Workflows lekérése (in-browser)...")
        wfs = await page.evaluate("""
            async () => {
                const r = await fetch('/rest/workflows', {credentials:'include'});
                const text = await r.text();
                return {status: r.status, body: text.substring(0, 5000)};
            }
        """)
        print(f"  Status: {wfs['status']}")
        print(f"  Body (első 800): {wfs['body'][:800]}")

        # --- In-browser fetch: WF06 részletek ---
        print("\n[C] Workflow 06 lekérése...")
        wf06 = await page.evaluate("""
            async () => {
                const r = await fetch('/rest/workflows/LGvkbQNUm44UEoMi', {credentials:'include'});
                const text = await r.text();
                return {status: r.status, body: text.substring(0, 8000)};
            }
        """)
        print(f"  Status: {wf06['status']}")
        print(f"  Body (első 1000): {wf06['body'][:1000]}")

        await page.screenshot(path=f"{SCREENSHOTS}\\n8n_fetch_test.png")
        await browser.close()

asyncio.run(main())
