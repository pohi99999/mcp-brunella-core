from playwright.sync_api import sync_playwright
import time, json, os

SCREENSHOTS = r"F:\mcp-brunella-core\_br_temp"

def ss(page, name):
    path = os.path.join(SCREENSHOTS, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"[SS] {path}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, slow_mo=400)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()

    print("=== N8N LOGIN with correct credentials ===")
    page.goto("https://iszapfalo.app.n8n.cloud/signin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    
    # Fill email - the correct email from .env
    page.locator('input[type="email"]').first.fill("peterpohankapersonal@gmail.com")
    page.wait_for_timeout(300)
    page.locator('input[type="password"]').first.fill("Iszapfalo2026")
    page.wait_for_timeout(300)
    ss(page, "n8n_correct_filled")
    
    page.locator('button[type="submit"]').first.click()
    page.wait_for_timeout(4000)
    ss(page, "n8n_after_correct_login")
    print(f"URL after login: {page.url}")
    
    if "signin" not in page.url:
        print("LOGIN SUCCESS!")
        
        # === CREDENTIALS ===
        print("\n=== CREDENTIALS PAGE ===")
        page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        ss(page, "n8n_credentials_page")
        
        body = page.locator("body").inner_text()
        print(f"CREDENTIALS TEXT:\n{body[:5000]}")
        
        # === WORKFLOWS ===
        print("\n=== WORKFLOWS PAGE ===")
        page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        ss(page, "n8n_workflows_page")
        
        wf_body = page.locator("body").inner_text()
        print(f"WORKFLOWS TEXT:\n{wf_body[:5000]}")
        
        # === EXECUTIONS ===
        print("\n=== EXECUTIONS PAGE ===")
        page.goto("https://iszapfalo.app.n8n.cloud/executions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        ss(page, "n8n_executions_page")
        
        exec_body = page.locator("body").inner_text()
        print(f"EXECUTIONS TEXT:\n{exec_body[:5000]}")
        
        # Check for 07 workflow
        has_07 = "07" in wf_body or "heti kontextus" in wf_body.lower()
        print(f"\n=== 07 WORKFLOW EXISTS: {has_07} ===")
        
    else:
        print("LOGIN FAILED!")
        body = page.locator("body").inner_text()
        print(f"Page: {body[:500]}")
        ss(page, "n8n_login_failed")
    
    browser.close()
