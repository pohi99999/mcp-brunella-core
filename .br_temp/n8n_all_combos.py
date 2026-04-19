from playwright.sync_api import sync_playwright
import time

def try_login(email, password):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, slow_mo=200)
        page = browser.new_context().new_page()
        page.goto("https://iszapfalo.app.n8n.cloud/signin")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.locator('input[type="email"]').first.fill(email)
        page.locator('input[type="password"]').first.fill(password)
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_timeout(3500)
        success = "signin" not in page.url
        body = page.locator("body").inner_text()
        if success:
            browser.close()
            return True, page.url
        err = "Wrong credentials" if "Wrong username" in body else ("Invalid email" if "valid email" in body else "Unknown")
        browser.close()
        return False, err

combos = [
    ("iszapfalo@gmail.com", "iszapfalo13"),
    ("iszapfalo@gmail.com", "Iszapfalo13"),
    ("iszapfalo@gmail.com", "IszapfaloAI25+"),
    ("peterpohankapersonal@gmail.com", "Iszapfalo2026"),
    ("iszapfalo@gmail.com", "iszapfalo2026"),
    ("iszapfalo@gmail.com", "Iszapfalo2026"),
    ("iszapfalo@gmail.com", "iszapfalo"),
    ("iszapfalo@gmail.com", "admin"),
]

print("=== N8N LOGIN ATTEMPTS ===")
for email, pw in combos:
    ok, info = try_login(email, pw)
    status = "✅ SUCCESS" if ok else f"❌ FAIL ({info})"
    print(f"  {email[:20]:<22} / {pw:<20} -> {status}")
    if ok:
        print(f"  Redirected to: {info}")
        break
