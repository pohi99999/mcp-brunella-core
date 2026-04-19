from playwright.sync_api import sync_playwright
import json, os, re

SCREENSHOTS = r"F:\mcp-brunella-core\_br_temp"

def ss(page, name):
    path = os.path.join(SCREENSHOTS, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"[SS] {path}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, slow_mo=300)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()

    print("=== N8N LOGIN ===")
    page.goto("https://iszapfalo.app.n8n.cloud/signin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    page.locator('input[type="email"]').first.fill("iszapfalo@gmail.com")
    page.locator('input[type="password"]').first.fill("Iszapfalo13")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Sign in").click()
    page.wait_for_timeout(4000)
    print(f"Logged in! URL: {page.url}")
    ss(page, "n8n_LOGGEDIN")

    # ==================== CREDENTIALS ====================
    print("\n=== CREDENTIALS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "n8n_CREDS")
    
    cred_body = page.locator("body").inner_text()
    print("CREDENTIALS PAGE TEXT:")
    print(cred_body[:8000])
    
    # Check specific credentials
    print("\n--- CREDENTIAL CHECKS ---")
    checks = ["ISZ_Airtable_PAT_v3", "ISZ_Airtable_Prod_v2", "Gmail account 4", "ISZ_GoogleDrive_Prod", "ISZ_GoogleCalendar_Prod"]
    for c in checks:
        exists = c in cred_body
        print(f"  {'✅' if exists else '❌'} {c}: {'EXISTS' if exists else 'NOT FOUND'}")

    # ==================== WORKFLOWS ====================
    print("\n=== WORKFLOWS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "n8n_WORKFLOWS")
    
    wf_body = page.locator("body").inner_text()
    print("WORKFLOWS PAGE TEXT:")
    print(wf_body[:8000])
    
    # Check 07 workflow
    has_07 = "07" in wf_body or "heti kontextus" in wf_body.lower() or "Heti Kontextus" in wf_body
    print(f"\n--- 07 WORKFLOW: {'✅ EXISTS' if has_07 else '❌ NOT FOUND'} ---")

    # ==================== EXECUTIONS ====================
    print("\n=== EXECUTIONS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/executions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "n8n_EXECUTIONS")
    
    exec_body = page.locator("body").inner_text()
    print("EXECUTIONS PAGE TEXT:")
    print(exec_body[:6000])

    browser.close()
    print("\n=== DONE ===")
