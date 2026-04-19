"""
Iszapfaló n8n rendszer állapot felmérő szkript
- Megnyitja az n8n-t
- Screenshot-ot készít a jelenlegi állapotról
- Listázza az összes workflow-t
"""
import asyncio
import base64
import json
from pathlib import Path
from playwright.async_api import async_playwright

N8N_URL = "https://iszapfalo.app.n8n.cloud"
OUTPUT_DIR = Path("F:/mcp-brunella-core/_br_temp")

async def check_n8n():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()
        
        print("1. Navigálás az n8n-be...")
        await page.goto(f"{N8N_URL}/home/workflows", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
        
        # Screenshot 1: kezdeti állapot
        await page.screenshot(path=str(OUTPUT_DIR / "n8n_01_start.png"), full_page=False)
        print(f"   Screenshot: n8n_01_start.png")
        
        # Mi az aktuális URL? (login? workflows?)
        current_url = page.url
        print(f"   Aktuális URL: {current_url}")
        
        # Megnézni hogy be vagyunk-e lépve
        title = await page.title()
        print(f"   Oldal cím: {title}")
        
        # Keressük a workflow listát
        if "signin" in current_url or "login" in current_url:
            print("\n⚠️  NINCS BEJELENTKEZVE! Login oldal jelent meg.")
            print("   Nem tudom automatikusan belépni jelszó nélkül.")
        else:
            print("\n✅ Be vagyunk lépve! Workflow lista olvasása...")
            
            # Várjuk meg a workflow lista betöltését
            try:
                await page.wait_for_selector('[data-test-id="resources-list-item"]', timeout=10000)
                workflow_items = await page.query_selector_all('[data-test-id="resources-list-item"]')
                print(f"   Talált workflow-k száma: {len(workflow_items)}")
                
                for i, item in enumerate(workflow_items):
                    name = await item.text_content()
                    print(f"   WF {i+1}: {name.strip()[:80] if name else '???'}")
                    
            except Exception as e:
                print(f"   Workflow lista elem nem található: {e}")
                
                # Próbáljuk a workflow kártyákat
                try:
                    cards = await page.query_selector_all('.workflow-card, [class*="workflow"], [data-test-id*="workflow"]')
                    print(f"   Workflow kártyák: {len(cards)}")
                    for card in cards[:10]:
                        txt = await card.text_content()
                        if txt and len(txt.strip()) > 3:
                            print(f"   - {txt.strip()[:80]}")
                except Exception as e2:
                    print(f"   Kártya keresés is sikertelen: {e2}")
            
            # Screenshot 2: workflow lista
            await page.screenshot(path=str(OUTPUT_DIR / "n8n_02_workflows.png"), full_page=True)
            print(f"\n   Screenshot: n8n_02_workflows.png")
            
            # Lekérjük az oldal HTML-jét
            content = await page.content()
            (OUTPUT_DIR / "n8n_page.html").write_text(content[:50000], encoding='utf-8')
            print(f"   HTML elmentve: n8n_page.html ({len(content)} karakter)")
        
        print("\nBöngésző bezárás...")
        await browser.close()
        print("Kész!")

if __name__ == "__main__":
    asyncio.run(check_n8n())
