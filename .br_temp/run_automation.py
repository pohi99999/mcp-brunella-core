from playwright.sync_api import sync_playwright
import time, json, os

SCREENSHOTS = r"F:\mcp-brunella-core\_br_temp"
os.makedirs(SCREENSHOTS, exist_ok=True)

def ss(page, name):
    path = os.path.join(SCREENSHOTS, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"[SCREENSHOT] {path}")

results = {}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, slow_mo=300)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()

    # ===== RÉSZ 1: Gmail =====
    print("\n=== GMAIL LOGIN ===")
    page.goto("https://accounts.google.com/signin")
    page.wait_for_load_state("networkidle")
    ss(page, "01_gmail_start")

    # Email input
    try:
        page.fill('input[type="email"]', "iszapfalo@gmail.com")
        page.click('button:has-text("Next"), #identifierNext')
        page.wait_for_timeout(2000)
        ss(page, "02_gmail_email_entered")
    except Exception as e:
        print(f"Email step error: {e}")
        ss(page, "02_gmail_email_error")

    # Password input
    try:
        page.wait_for_selector('input[type="password"]', timeout=10000)
        page.fill('input[type="password"]', "IszapfaloAI25+")
        page.click('button:has-text("Next"), #passwordNext')
        page.wait_for_timeout(3000)
        ss(page, "03_gmail_after_password")
    except Exception as e:
        print(f"Password step error: {e}")
        ss(page, "03_gmail_password_error")

    # Check current URL - 2FA or success?
    current_url = page.url
    page_content = page.content()
    print(f"Current URL after login: {current_url}")
    
    if "challenge" in current_url or "signin/v2/challenge" in current_url or "2-Step" in page_content:
        print("!!! 2FA REQUIRED - megállok !!!")
        results["gmail_login"] = "2FA_REQUIRED"
        results["gmail_labels"] = "SKIPPED"
        ss(page, "03_gmail_2FA_screen")
    elif "mail.google.com" in current_url or "myaccount.google.com" in current_url:
        print("Gmail login SUCCESS!")
        results["gmail_login"] = "SUCCESS"
        
        # Navigate to labels settings
        page.goto("https://mail.google.com/mail/u/0/#settings/labels")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        ss(page, "04_gmail_labels_page")
        
        labels_to_create = ["❗_Sürgős", "💡_Ajánlatkérés", "🛠_Kotrás"]
        created_labels = []
        
        for label in labels_to_create:
            try:
                print(f"Creating label: {label}")
                # Find "Create new label" button
                page.wait_for_timeout(1000)
                
                # Try clicking Create new label
                create_btn = page.locator('text="Create new label"').first
                if create_btn.is_visible():
                    create_btn.click()
                else:
                    # Try finding by partial text
                    page.locator('[data-action="create"], button:has-text("Create new label")').first.click()
                
                page.wait_for_timeout(1500)
                ss(page, f"05_create_label_dialog_{label[:5]}")
                
                # Fill in label name
                dialog_input = page.locator('input[name="label"], input[placeholder*="label"], .J-JN-M-I input').first
                dialog_input.fill(label)
                page.wait_for_timeout(500)
                
                # Click Create button in dialog
                page.locator('button:has-text("Create"), .J-JN-M-I-Jh').first.click()
                page.wait_for_timeout(1500)
                ss(page, f"06_label_created_{label[:5]}")
                
                created_labels.append(label)
                print(f"  -> Label created: {label}")
            except Exception as e:
                print(f"  -> Label creation error for {label}: {e}")
                ss(page, f"06_label_error_{label[:5]}")
        
        results["gmail_labels"] = created_labels
        
        # Check sidebar
        page.goto("https://mail.google.com/mail/u/0/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        ss(page, "07_gmail_sidebar_after_labels")
        
    else:
        print(f"Unknown state after login. URL: {current_url}")
        results["gmail_login"] = f"UNKNOWN: {current_url}"
        results["gmail_labels"] = "SKIPPED"
        ss(page, "03_gmail_unknown_state")

    # ===== RÉSZ 2: n8n =====
    print("\n=== N8N LOGIN ===")
    page.goto("https://iszapfalo.app.n8n.cloud/signin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    ss(page, "10_n8n_signin")

    # Try login with "iszapfalo"
    try:
        email_field = page.locator('input[type="email"], input[name="email"], #email').first
        email_field.fill("iszapfalo@gmail.com")
        page.locator('input[type="password"], input[name="password"], #password').first.fill("iszapfalo13")
        page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first.click()
        page.wait_for_timeout(3000)
        ss(page, "11_n8n_after_login")
        print(f"n8n URL after login: {page.url}")
    except Exception as e:
        print(f"n8n login error: {e}")
        ss(page, "11_n8n_login_error")

    n8n_url = page.url
    if "signin" in n8n_url:
        print("n8n login may have failed, checking...")
        results["n8n_login"] = f"POSSIBLE_FAIL: {n8n_url}"
    else:
        results["n8n_login"] = "SUCCESS"
        print("n8n login SUCCESS")

    # Credentials page
    print("\n=== N8N CREDENTIALS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "12_n8n_credentials")

    creds_content = page.content()
    # Extract credential names from page
    cred_names = page.locator('[data-test-id="resources-list-item"], .resource-name, .credential-name, h3, .el-card__body').all_text_contents()
    print(f"Credential page texts: {cred_names[:30]}")
    results["n8n_credentials_raw"] = cred_names[:50]

    # Check specific credentials
    target_creds = ["ISZ_Airtable_PAT_v3", "ISZ_Airtable_Prod_v2", "Gmail account 4", "ISZ_GoogleDrive_Prod", "ISZ_GoogleCalendar_Prod"]
    for c in target_creds:
        exists = c in creds_content
        print(f"  {c}: {'EXISTS' if exists else 'NOT FOUND'}")
    
    results["n8n_cred_checks"] = {c: (c in creds_content) for c in target_creds}

    # Workflows page
    print("\n=== N8N WORKFLOWS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "13_n8n_workflows")

    wf_content = page.content()
    wf_texts = page.locator('[data-test-id="resources-list-item"], .workflow-name, h3, .resource-card').all_text_contents()
    print(f"Workflow texts (first 20): {wf_texts[:20]}")
    results["n8n_workflows_raw"] = wf_texts[:20]

    has_07 = any("07" in w or "Heti Kontextus" in w or "heti" in w.lower() for w in wf_texts)
    print(f"07/Heti Kontextus workflow exists: {has_07}")
    results["n8n_has_07_workflow"] = has_07

    # Executions page
    print("\n=== N8N EXECUTIONS ===")
    page.goto("https://iszapfalo.app.n8n.cloud/executions")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "14_n8n_executions")

    exec_texts = page.locator('[data-test-id="execution-list-item"], .execution-item, tr, .el-table__row').all_text_contents()
    print(f"Execution rows (first 15): {exec_texts[:15]}")
    results["n8n_executions_raw"] = exec_texts[:15]

    browser.close()

# Save results
with open(r"F:\mcp-brunella-core\_br_temp\automation_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("\n=== FINAL RESULTS ===")
print(json.dumps(results, ensure_ascii=False, indent=2))
