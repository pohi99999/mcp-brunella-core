from playwright.sync_api import sync_playwright
import time, json, os

SCREENSHOTS = r"F:\mcp-brunella-core\_br_temp"

def ss(page, name):
    path = os.path.join(SCREENSHOTS, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"[SCREENSHOT] {path}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, slow_mo=500)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()

    print("=== N8N LOGIN DEBUG ===")
    page.goto("https://iszapfalo.app.n8n.cloud/signin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    ss(page, "n8n_01_signin_page")
    
    # Get all input fields
    inputs = page.locator("input").all()
    for i, inp in enumerate(inputs):
        try:
            print(f"Input {i}: type={inp.get_attribute('type')}, name={inp.get_attribute('name')}, id={inp.get_attribute('id')}, placeholder={inp.get_attribute('placeholder')}")
        except:
            pass
    
    # Try with email input
    try:
        # Look for email field
        email_inp = page.locator('input[type="email"]')
        if email_inp.count() > 0:
            email_inp.first.fill("iszapfalo@gmail.com")
            print("Filled email field with iszapfalo@gmail.com")
        else:
            # Try generic text field
            page.locator('input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]').first.fill("iszapfalo@gmail.com")
            print("Filled via name/placeholder selector")
        
        page.wait_for_timeout(500)
        
        pw_inp = page.locator('input[type="password"]')
        pw_inp.first.fill("iszapfalo13")
        print("Filled password")
        
        page.wait_for_timeout(500)
        ss(page, "n8n_02_filled")
        
        # Submit
        submit_btn = page.locator('button[type="submit"]')
        if submit_btn.count() > 0:
            submit_btn.first.click()
            print("Clicked submit button")
        else:
            page.keyboard.press("Enter")
            print("Pressed Enter")
        
        page.wait_for_timeout(4000)
        ss(page, "n8n_03_after_submit")
        print(f"URL after submit: {page.url}")
        
        # If still on signin, try with just "iszapfalo"
        if "signin" in page.url:
            print("Still on signin - trying 'iszapfalo' as email")
            page.reload()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            
            email_inp = page.locator('input[type="email"]')
            if email_inp.count() > 0:
                email_inp.first.fill("iszapfalo")
            else:
                page.locator('input').first.fill("iszapfalo")
            
            page.wait_for_timeout(300)
            page.locator('input[type="password"]').first.fill("iszapfalo13")
            page.wait_for_timeout(300)
            
            submit_btn = page.locator('button[type="submit"]')
            if submit_btn.count() > 0:
                submit_btn.first.click()
            else:
                page.keyboard.press("Enter")
            
            page.wait_for_timeout(4000)
            ss(page, "n8n_04_after_second_attempt")
            print(f"URL after second attempt: {page.url}")
        
        # If logged in, get credentials
        if "signin" not in page.url:
            print("N8N LOGIN SUCCESS!")
            
            page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            ss(page, "n8n_05_credentials")
            
            # Try multiple selectors for credentials
            print("--- PAGE TITLE:", page.title())
            print("--- URL:", page.url)
            
            # Get all visible text
            body_text = page.locator("body").inner_text()
            print(f"--- CREDENTIALS PAGE TEXT (first 3000 chars):\n{body_text[:3000]}")
            
            # Workflows
            page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            ss(page, "n8n_06_workflows")
            
            wf_text = page.locator("body").inner_text()
            print(f"--- WORKFLOWS PAGE TEXT (first 3000 chars):\n{wf_text[:3000]}")
            
            # Executions
            page.goto("https://iszapfalo.app.n8n.cloud/executions")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            ss(page, "n8n_07_executions")
            
            exec_text = page.locator("body").inner_text()
            print(f"--- EXECUTIONS PAGE TEXT (first 3000 chars):\n{exec_text[:3000]}")
        else:
            print("N8N LOGIN FAILED")
            # Get error message
            body_text = page.locator("body").inner_text()
            print(f"Page text: {body_text[:500]}")
            
    except Exception as e:
        print(f"Error: {e}")
        ss(page, "n8n_error")
    
    browser.close()
