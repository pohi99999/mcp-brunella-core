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

    print("=== N8N LOGIN ===")
    page.goto("https://iszapfalo.app.n8n.cloud/signin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    
    # Check all buttons on page
    buttons = page.locator("button").all()
    for i, b in enumerate(buttons):
        try:
            print(f"  Button {i}: text='{b.inner_text()}' visible={b.is_visible()}")
        except: pass
    
    # Fill credentials
    page.locator('input[type="email"]').first.fill("peterpohankapersonal@gmail.com")
    page.wait_for_timeout(300)
    page.locator('input[type="password"]').first.fill("Iszapfalo2026")
    page.wait_for_timeout(500)
    
    # Click Sign in button by text
    try:
        page.get_by_role("button", name="Sign in").click()
        print("Clicked via get_by_role")
    except Exception as e:
        print(f"get_by_role failed: {e}")
        try:
            page.locator("button").filter(has_text="Sign in").click()
            print("Clicked via filter has_text")
        except Exception as e2:
            print(f"filter failed: {e2}")
            # Try keyboard Enter
            page.keyboard.press("Enter")
            print("Pressed Enter")
    
    page.wait_for_timeout(5000)
    ss(page, "n8n_v2_after_login")
    print(f"URL after login: {page.url}")
    
    if "signin" not in page.url:
        print("=== N8N LOGIN SUCCESS! ===")
        
        # CREDENTIALS
        print("\n--- CREDENTIALS ---")
        page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        ss(page, "n8n_v2_creds")
        body = page.locator("body").inner_text()
        print(body[:6000])
        
        # WORKFLOWS
        print("\n--- WORKFLOWS ---")
        page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        ss(page, "n8n_v2_workflows")
        wf_body = page.locator("body").inner_text()
        print(wf_body[:6000])
        
        # EXECUTIONS
        print("\n--- EXECUTIONS ---")
        page.goto("https://iszapfalo.app.n8n.cloud/executions")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        ss(page, "n8n_v2_executions")
        exec_body = page.locator("body").inner_text()
        print(exec_body[:4000])
        
    else:
        print("LOGIN FAILED")
        body = page.locator("body").inner_text()
        print(f"Page: {body[:1000]}")
    
    browser.close()
