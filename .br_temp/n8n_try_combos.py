from playwright.sync_api import sync_playwright

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
        page.wait_for_timeout(3000)
        success = "signin" not in page.url
        body = page.locator("body").inner_text()
        error_msg = ""
        if "Wrong username" in body or "Problem logging" in body:
            error_msg = "Wrong credentials"
        elif "Must be a valid email" in body:
            error_msg = "Invalid email format"
        browser.close()
        return success, page.url, error_msg

combos = [
    ("iszapfalo@gmail.com", "iszapfalo13"),
    ("iszapfalo@gmail.com", "Iszapfalo2026"),
    ("iszapfalo@gmail.com", "IszapfaloAI25+"),
    ("peterpohankapersonal@gmail.com", "iszapfalo13"),
    ("peterpohankapersonal@gmail.com", "Iszapfalo2026!"),
]

for email, pw in combos:
    ok, url, err = try_login(email, pw)
    status = "SUCCESS" if ok else f"FAIL ({err})"
    print(f"  {email} / {pw[:8]}... -> {status}")
    if ok:
        print(f"    Redirected to: {url}")
        break
