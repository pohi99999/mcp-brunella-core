"""
Browser automation: Gmail labels + n8n check
"""
from playwright.sync_api import sync_playwright
import time
import json
import os

SCREENSHOT_DIR = r"F:\mcp-brunella-core\_br_temp\screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def ss(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=False)
    print(f"[SCREENSHOT] {path}")
    return path

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, slow_mo=300)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        results = {}

        # ============================================================
        # RÉSZ 1: Gmail login
        # ============================================================
        print("\n=== RÉSZ 1: Gmail login ===")
        page.goto("https://accounts.google.com/signin/v2/identifier?service=mail")
        page.wait_for_load_state("networkidle", timeout=15000)
        ss(page, "01_gmail_start")

        # Email
        try:
            email_field = page.wait_for_selector('input[type="email"]', timeout=10000)
            email_field.fill("iszapfalo@gmail.com")
            page.keyboard.press("Enter")
            page.wait_for_timeout(2000)
            ss(page, "02_gmail_email_entered")
            print("[OK] Email megadva")
        except Exception as e:
            print(f"[HIBA] Email mező: {e}")
            ss(page, "02_gmail_email_error")

        # Password
        try:
            pwd_field = page.wait_for_selector('input[type="password"]', timeout=10000)
            pwd_field.fill("IszapfaloAI25+")
            page.keyboard.press("Enter")
            page.wait_for_timeout(3000)
            ss(page, "03_gmail_after_password")
            print("[OK] Jelszó megadva")
        except Exception as e:
            print(f"[HIBA] Jelszó mező: {e}")
            ss(page, "03_gmail_password_error")

        # Check for 2FA / verification
        page.wait_for_timeout(3000)
        current_url = page.url
        page_text = page.inner_text("body")
        ss(page, "04_gmail_state_check")
        
        print(f"[URL] {current_url}")
        
        # Detect 2FA
        two_fa_keywords = ["2-Step", "2FA", "verification", "Verify it", "phone", "authenticator", 
                           "ellenőrzés", "kétlépéses", "megerősítés", "code", "kód"]
        is_2fa = any(kw.lower() in page_text.lower() for kw in two_fa_keywords)
        is_gmail = "mail.google.com" in current_url or "inbox" in current_url.lower()
        
        if is_2fa and not is_gmail:
            print("\n⚠️  2FA / VERIFICATION SZÜKSÉGES!")
            print("Az oldal szövege (első 500 kar):")
            print(page_text[:500])
            results["gmail_login"] = "2FA_REQUIRED"
            results["gmail_labels"] = "SKIPPED - 2FA blocked"
            # Don't stop, screenshot and continue
            ss(page, "04b_2fa_screen")
        elif is_gmail or "myaccount.google.com" in current_url:
            print("[OK] Gmail bejelentkezés SIKERES!")
            results["gmail_login"] = "SUCCESS"
            
            # Navigate to labels settings
            print("\n--- Label létrehozás ---")
            page.goto("https://mail.google.com/mail/u/0/#settings/labels")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            ss(page, "05_gmail_labels_page")
            
            labels_created = []
            labels_to_create = ["❗_Sürgős", "💡_Ajánlatkérés", "🛠_Kotrás"]
            
            for i, label_name in enumerate(labels_to_create):
                print(f"\n[LABEL] Létrehozás: {label_name}")
                try:
                    # Find "Create new label" button
                    # Try multiple selectors
                    create_btn = None
                    for sel in [
                        'text="Create new label"',
                        'button:has-text("Create new label")',
                        '[role="button"]:has-text("Create new label")',
                        'text="Új cimke létrehozása"',
                        'text="Új label"',
                    ]:
                        try:
                            create_btn = page.wait_for_selector(sel, timeout=5000)
                            if create_btn:
                                break
                        except:
                            pass
                    
                    if not create_btn:
                        print(f"[HIBA] 'Create new label' gomb nem található")
                        ss(page, f"05_label_{i}_no_button")
                        continue
                    
                    create_btn.click()
                    page.wait_for_timeout(1500)
                    ss(page, f"06_label_{i}_dialog")
                    
                    # Fill label name in dialog
                    dialog_input = None
                    for sel in [
                        'input[placeholder*="label"]',
                        'input[placeholder*="Label"]',
                        'input[placeholder*="cimke"]',
                        'input[name="name"]',
                        'div[role="dialog"] input',
                        '.Zh input',
                        'input[aria-label*="label"]',
                        'input[aria-label*="Label"]',
                    ]:
                        try:
                            dialog_input = page.wait_for_selector(sel, timeout=3000)
                            if dialog_input:
                                break
                        except:
                            pass
                    
                    if not dialog_input:
                        # Try any visible input in dialog
                        page.keyboard.press("Tab")
                        page.wait_for_timeout(500)
                        dialog_input = page.query_selector('div[role="dialog"] input, [aria-modal="true"] input')
                    
                    if dialog_input:
                        dialog_input.click()
                        dialog_input.fill(label_name)
                        page.wait_for_timeout(500)
                        ss(page, f"07_label_{i}_filled")
                        
                        # Click Create button in dialog
                        for sel in [
                            'button:has-text("Create")',
                            'button:has-text("Létrehozás")',
                            '[role="button"]:has-text("Create")',
                            'div[role="dialog"] button:last-child',
                        ]:
                            try:
                                btn = page.wait_for_selector(sel, timeout=3000)
                                if btn:
                                    btn.click()
                                    break
                            except:
                                pass
                        
                        page.wait_for_timeout(2000)
                        ss(page, f"08_label_{i}_after_create")
                        print(f"[OK] Label létrehozva: {label_name}")
                        labels_created.append(label_name)
                    else:
                        print(f"[HIBA] Dialog input nem található")
                        ss(page, f"07_label_{i}_no_input")
                        # Close dialog with Escape
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(1000)
                
                except Exception as e:
                    print(f"[HIBA] Label '{label_name}': {e}")
                    ss(page, f"label_{i}_error")
                    try:
                        page.keyboard.press("Escape")
                    except:
                        pass
                    page.wait_for_timeout(1000)
            
            results["gmail_labels_created"] = labels_created
            
            # Verify labels in sidebar
            page.goto("https://mail.google.com/mail/u/0/")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            ss(page, "09_gmail_inbox_sidebar")
            sidebar_text = page.inner_text("body")
            
            found_labels = []
            for lbl in labels_to_create:
                if lbl in sidebar_text or lbl.split("_")[1] in sidebar_text:
                    found_labels.append(lbl)
            results["gmail_labels_visible"] = found_labels
            print(f"\n[LABELS VISIBLE] {found_labels}")
        else:
            print(f"[INFO] Váratlan állapot. URL: {current_url}")
            print(f"Szöveg: {page_text[:300]}")
            results["gmail_login"] = f"UNKNOWN - url: {current_url}"
            results["gmail_labels"] = "SKIPPED"

        # ============================================================
        # RÉSZ 2: n8n login
        # ============================================================
        print("\n=== RÉSZ 2: n8n login ===")
        page.goto("https://iszapfalo.app.n8n.cloud/signin")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        ss(page, "10_n8n_signin")

        # Try login with "iszapfalo" first
        n8n_logged_in = False
        for attempt, email_val in enumerate(["iszapfalo", "iszapfalo@gmail.com"]):
            print(f"\n[n8n] Login próba {attempt+1}: email='{email_val}'")
            try:
                # Clear and fill email
                email_f = page.wait_for_selector('input[type="email"], input[name="email"], #email', timeout=8000)
                email_f.triple_click()
                email_f.fill(email_val)
                
                pwd_f = page.wait_for_selector('input[type="password"], input[name="password"], #password', timeout=5000)
                pwd_f.triple_click()
                pwd_f.fill("iszapfalo13")
                
                ss(page, f"11_n8n_login_attempt_{attempt+1}")
                
                # Submit
                submit = None
                for sel in ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Bejelentkezés")', 'button:has-text("Login")']:
                    try:
                        submit = page.wait_for_selector(sel, timeout=3000)
                        if submit:
                            break
                    except:
                        pass
                
                if submit:
                    submit.click()
                else:
                    page.keyboard.press("Enter")
                
                page.wait_for_timeout(4000)
                current_url = page.url
                ss(page, f"12_n8n_after_login_{attempt+1}")
                
                if "signin" not in current_url and "n8n.cloud" in current_url:
                    print(f"[OK] n8n bejelentkezés SIKERES! URL: {current_url}")
                    n8n_logged_in = True
                    results["n8n_login"] = f"SUCCESS with '{email_val}'"
                    break
                else:
                    print(f"[INFO] Még mindig signin oldalon. URL: {current_url}")
                    if attempt == 0:
                        page.goto("https://iszapfalo.app.n8n.cloud/signin")
                        page.wait_for_load_state("networkidle", timeout=10000)
                        page.wait_for_timeout(1000)
            except Exception as e:
                print(f"[HIBA] n8n login attempt {attempt+1}: {e}")
                ss(page, f"n8n_login_error_{attempt+1}")

        if not n8n_logged_in:
            results["n8n_login"] = "FAILED"
            print("[HIBA] n8n bejelentkezés sikertelen!")

        # ============================================================
        # RÉSZ 2 (continued): Credentials
        # ============================================================
        print("\n=== n8n Credentials ===")
        page.goto("https://iszapfalo.app.n8n.cloud/home/credentials")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(3000)
        ss(page, "13_n8n_credentials")

        # Extract credential list
        cred_text = page.inner_text("body")
        print("[PAGE TEXT credentials]", cred_text[:2000])
        
        # Try to find credential items
        credentials = []
        try:
            # Try table rows or list items
            rows = page.query_selector_all('tr, [data-test-id="credential-card"], .credential-card, [class*="credential"]')
            for row in rows:
                txt = row.inner_text().strip()
                if txt and len(txt) > 2:
                    credentials.append(txt[:100])
        except:
            pass
        
        # Check for specific credentials
        target_creds = [
            "ISZ_Airtable_PAT_v3",
            "ISZ_Airtable_Prod_v2", 
            "Gmail account 4",
            "ISZ_GoogleDrive_Prod",
            "ISZ_GoogleCalendar_Prod"
        ]
        
        cred_check = {}
        for tc in target_creds:
            cred_check[tc] = tc in cred_text
        
        results["credentials_check"] = cred_check
        results["credentials_raw_preview"] = cred_text[:3000]
        print(f"\n[CREDENTIALS CHECK]")
        for k, v in cred_check.items():
            print(f"  {'✅' if v else '❌'} {k}: {'LÉTEZIK' if v else 'NEM TALÁLHATÓ'}")

        # ============================================================
        # RÉSZ 2: Workflows
        # ============================================================
        print("\n=== n8n Workflows ===")
        page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(3000)
        ss(page, "14_n8n_workflows")

        wf_text = page.inner_text("body")
        print("[WORKFLOWS PAGE TEXT]", wf_text[:3000])
        
        # Try to get workflow cards/rows
        workflows = []
        try:
            wf_items = page.query_selector_all('[data-test-id="workflow-card"], .workflow-card, tr[class*="workflow"], [class*="workflowItem"]')
            for item in wf_items[:20]:
                txt = item.inner_text().strip()
                if txt:
                    workflows.append(txt[:150])
        except:
            pass
        
        results["workflows_page_text"] = wf_text[:3000]
        
        # Check for 07 / Heti Kontextus
        has_07 = "07" in wf_text
        has_heti = "Heti Kontextus" in wf_text or "heti kontextus" in wf_text.lower()
        results["workflow_07_exists"] = has_07 or has_heti
        print(f"\n[WORKFLOW 07] '07' in page: {has_07}, 'Heti Kontextus' in page: {has_heti}")

        # ============================================================
        # RÉSZ 2: Executions
        # ============================================================
        print("\n=== n8n Executions ===")
        page.goto("https://iszapfalo.app.n8n.cloud/executions")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(3000)
        ss(page, "15_n8n_executions")

        exec_text = page.inner_text("body")
        print("[EXECUTIONS TEXT]", exec_text[:3000])
        results["executions_page_text"] = exec_text[:3000]

        # ============================================================
        # RÉSZ 3: Import 07 workflow if needed
        # ============================================================
        if not (has_07 or has_heti):
            print("\n=== RÉSZ 3: 07-es workflow import ===")
            workflow_file = r"F:\mcp-brunella-core\.worktrees\N8N_PRO\N8N_PRO\07_heti_kontextus_workflow_FIXED.json"
            
            page.goto("https://iszapfalo.app.n8n.cloud/home/workflows")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
            ss(page, "16_n8n_workflows_for_import")
            
            # Look for import button
            import_clicked = False
            for sel in [
                'button:has-text("Import")',
                '[data-test-id="workflow-import-button"]',
                'button:has-text("Add workflow")',
                'button:has-text("New")',
                'text="Import from File"',
            ]:
                try:
                    btn = page.wait_for_selector(sel, timeout=3000)
                    if btn:
                        btn.click()
                        page.wait_for_timeout(1500)
                        ss(page, "17_n8n_import_menu")
                        import_clicked = True
                        break
                except:
                    pass
            
            if import_clicked:
                # Handle file input
                try:
                    with page.expect_file_chooser(timeout=5000) as fc_info:
                        for sel in ['input[type="file"]', 'text="Import from File"', 'text="From file"']:
                            try:
                                f = page.wait_for_selector(sel, timeout=2000)
                                if f:
                                    f.click()
                                    break
                            except:
                                pass
                    file_chooser = fc_info.value
                    file_chooser.set_files(workflow_file)
                    page.wait_for_timeout(3000)
                    ss(page, "18_n8n_after_import")
                    print("[OK] Workflow import elvégezve")
                    results["workflow_07_import"] = "ATTEMPTED"
                except Exception as e:
                    print(f"[HIBA] Import file chooser: {e}")
                    ss(page, "18_n8n_import_error")
                    results["workflow_07_import"] = f"ERROR: {e}"
            else:
                print("[HIBA] Import gomb nem található")
                results["workflow_07_import"] = "IMPORT_BUTTON_NOT_FOUND"
        else:
            print("\n[INFO] 07-es workflow már létezik, import nem szükséges")
            results["workflow_07_import"] = "NOT_NEEDED - already exists"

        # Final screenshot
        ss(page, "99_final_state")
        
        browser.close()
        
        # Print summary
        print("\n" + "="*60)
        print("ÖSSZEFOGLALÓ EREDMÉNYEK:")
        print("="*60)
        print(json.dumps(results, ensure_ascii=False, indent=2))
        
        return results

if __name__ == "__main__":
    run()
