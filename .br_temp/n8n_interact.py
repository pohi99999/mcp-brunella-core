"""
Iszapfaló n8n - Interaktív bejelentkezés + Automatikus feltérképezés
1. Megnyit egy VALÓDI böngészőt (nem headless)
2. Várja hogy bejelentkezel
3. Utána automatikusan feltérképezi és riportot készít
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

N8N_URL = "https://iszapfalo.app.n8n.cloud"
OUT_DIR = Path("F:/mcp-brunella-core/_br_temp")
SESSION_FILE = OUT_DIR / "n8n_session.json"

IMPORT_DIR = Path("F:/mcp-brunella-core/docs/Egyéb/Iszapfull_nyilvan/IMPORT_READY_PACK_2026_03_13")

IMPORT_ORDER = [
    "02_ai_agent_asszisztens_v2_javitott.json",
    "06_telegram_parancsok_statusz_het.json",
    "05_heti_emlekezteto_csutortok_1600.json",
    "04_google_calendar_airtable_szinkron.json",
    "03_airtable_google_calendar_feladat_keszito.json",
    "01_feladat_status_telegram_chat.json",
    "07_telegram_hangvezerles_teljes_rendszer.json",
]


async def interactive_login():
    """Megnyit egy böngészőt, bejelentkeztetés vár, menti a session-t"""
    print("🌐 Böngésző megnyitása bejelentkezéshez...")
    print("   Kérlek lépj be az n8n-be (Google OAuth-al),")
    print("   majd nyomj ENTER-t itt ebben az ablakban!\n")

    async with async_playwright() as p:
        # Korábban elmentett session betöltése
        storage_state = str(SESSION_FILE) if SESSION_FILE.exists() else None
        
        browser = await p.chromium.launch(
            headless=False,
            slow_mo=200
        )
        context = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            storage_state=storage_state
        )
        page = await context.new_page()
        
        await asyncio.sleep(1)
        await page.goto(f"{N8N_URL}/home/workflows", timeout=60000)
        
        # Ellenőrzés - be van lépve?
        await asyncio.sleep(4)
        current_url = page.url
        
        if "signin" in current_url or "login" in current_url:
            print("⚠️  Login oldal! Kérlek jelentkezz be a böngészőben.")
            print("\n👆 Lépj be Google-al, aztán NYOMJ ENTER-T IDE: ")
            input()
        else:
            print("✅ Már be vagy lépve! Folytatás...")
        
        # Session mentése
        await context.storage_state(path=str(SESSION_FILE))
        print(f"💾 Session elmentve: {SESSION_FILE}")
        
        # Screenshot az aktuális állapotról
        await page.goto(f"{N8N_URL}/home/workflows")
        await asyncio.sleep(2)
        await page.screenshot(path=str(OUT_DIR / "n8n_logged_in.png"))
        print("📸 Screenshot: n8n_logged_in.png")
        
        title = await page.title()
        url = page.url
        print(f"📍 URL: {url}")
        print(f"📌 Cím: {title}")
        
        await browser.close()
    
    return SESSION_FILE.exists()


async def list_workflows():
    """Listázza az n8n-ben lévő összes workflow-t (bejelentkezett session-nel)"""
    if not SESSION_FILE.exists():
        print("❌ Nincs mentett session! Futtasd először: python n8n_interact.py --login")
        return []
    
    print("\n📋 Workflow lista lekérése...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=str(SESSION_FILE))
        page = await context.new_page()
        
        # n8n REST API-jánál jobb az API key, de megpróbáljuk page-el is
        await page.goto(f"{N8N_URL}/home/workflows")
        await asyncio.sleep(3)
        
        # Ha session lejárt
        if "signin" in page.url:
            print("⚠️  Session lejárt! Futtasd: python n8n_interact.py --login")
            await browser.close()
            return []
        
        await page.screenshot(path=str(OUT_DIR / "n8n_workflow_list.png"), full_page=True)
        
        # Workflow-k kiszedése a DOM-ból
        workflows = []
        try:
            # Várjuk a listát
            await page.wait_for_selector('[data-test-id="resources-list-item"]', timeout=8000)
            items = await page.query_selector_all('[data-test-id="resources-list-item"]')
            for item in items:
                txt = await item.text_content()
                workflows.append(txt.strip() if txt else "???")
        except:
            # Fallback: keressük a workflow neveket
            names = await page.query_selector_all('[class*="workflow-name"], .el-card__body h2, [data-test-id*="workflow"] span')
            for n in names:
                txt = await n.text_content()
                if txt and len(txt.strip()) > 2:
                    workflows.append(txt.strip())
        
        # HTML mentése
        content = await page.content()
        (OUT_DIR / "n8n_workflows_raw.html").write_text(content, encoding="utf-8")
        
        await browser.close()
    
    print(f"\n✅ Talált {len(workflows)} workflow:")
    for i, wf in enumerate(workflows, 1):
        print(f"  {i:>2}. {wf[:70]}")
    
    return workflows


async def import_single_workflow(page, filepath: Path) -> dict:
    """Importál egyetlen JSON workflow-t az n8n UI-on keresztül"""
    print(f"\n  📥 Import: {filepath.name}")
    
    # Navigálás az import dialoghoz
    await page.goto(f"{N8N_URL}/home/workflows")
    await asyncio.sleep(2)
    
    # "Add workflow" gomb
    try:
        # Keressük az "Import" gombot/menüpontot
        import_selectors = [
            '[data-test-id="workflow-import-button"]',
            'button:has-text("Import")',
            '[class*="import"]',
            'button:has-text("Add workflow")',
        ]
        
        for sel in import_selectors:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                print(f"    Gomb megtalálva: {sel}")
                break
        
        await asyncio.sleep(1)
        
        # File input keresése
        file_input = await page.query_selector('input[type="file"]')
        if file_input:
            await file_input.set_files(str(filepath))
            await asyncio.sleep(2)
            print(f"    ✅ Fájl feltöltve!")
            
            # Mentés
            save_btn = await page.query_selector('button:has-text("Save"), button:has-text("Import"), [data-test-id="workflow-save-button"]')
            if save_btn:
                await save_btn.click()
                await asyncio.sleep(2)
                print(f"    ✅ Importálva és mentve!")
                return {"success": True, "file": filepath.name}
            else:
                return {"success": False, "error": "Save button not found", "file": filepath.name}
        else:
            # Screenshot a debug-hoz
            await page.screenshot(path=str(OUT_DIR / f"import_debug_{filepath.stem}.png"))
            return {"success": False, "error": "No file input found", "file": filepath.name}
    
    except Exception as e:
        return {"success": False, "error": str(e), "file": filepath.name}


async def do_import_all():
    """Importálja az összes IMPORT_READY workflow-t"""
    if not SESSION_FILE.exists():
        print("❌ Nincs session! --login kapcsolóval előbb lépj be!")
        return
    
    print("\n🚀 IMPORT_READY_PACK IMPORTÁLÁSA INDUL...")
    
    # Először listázzuk a meglévőket
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=300)
        context = await browser.new_context(storage_state=str(SESSION_FILE), viewport={"width": 1400, "height": 900})
        page = await context.new_page()
        
        await page.goto(f"{N8N_URL}/home/workflows")
        await asyncio.sleep(3)
        
        if "signin" in page.url:
            print("⚠️  Session lejárt! --login")
            await browser.close()
            return
        
        # Screenshot - állapot előtt
        await page.screenshot(path=str(OUT_DIR / "n8n_before_import.png"), full_page=True)
        
        results = []
        for filename in IMPORT_ORDER:
            fp = IMPORT_DIR / filename
            if not fp.exists():
                print(f"  ⚠️  Fájl nem található: {filename}")
                continue
            
            result = await import_single_workflow(page, fp)
            results.append(result)
            
            if result["success"]:
                print(f"  ✅ {filename}")
            else:
                print(f"  ❌ {filename}: {result.get('error', '???')}")
        
        # Screenshot - állapot után  
        await page.goto(f"{N8N_URL}/home/workflows")
        await asyncio.sleep(3)
        await page.screenshot(path=str(OUT_DIR / "n8n_after_import.png"), full_page=True)
        
        await browser.close()
    
    # Eredmény összefoglaló
    ok = sum(1 for r in results if r.get("success"))
    fail = len(results) - ok
    print(f"\n📊 EREDMÉNY: {ok} sikeres / {fail} sikertelen importálás")
    
    if fail > 0:
        print("❌ Sikertelen importok:")
        for r in results:
            if not r.get("success"):
                print(f"   - {r['file']}: {r.get('error', '???')}")


if __name__ == "__main__":
    import sys
    
    mode = "--login" if len(sys.argv) < 2 else sys.argv[1]
    
    if mode == "--login":
        print("=" * 60)
        print("  ISZAPFALÓ N8N - BEJELENTKEZÉSI SEGÍTŐ")
        print("=" * 60)
        ok = asyncio.run(interactive_login())
        if ok:
            print("\n✅ Kész! Most már futtathatod:")
            print("   python n8n_interact.py --list   (workflow lista)")
            print("   python n8n_interact.py --import (workflow importálás)")
    
    elif mode == "--list":
        asyncio.run(list_workflows())
    
    elif mode == "--import":
        asyncio.run(do_import_all())
    
    else:
        print("Használat:")
        print("  python n8n_interact.py --login    # Bejelentkezés (ELSŐ LÉPÉS!)")
        print("  python n8n_interact.py --list     # Workflow lista")
        print("  python n8n_interact.py --import   # IMPORT_READY feltöltése")
