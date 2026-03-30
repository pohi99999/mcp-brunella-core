"""
Step 5 retry: use confirmed data-test-id selector for login, then check logout.
"""
import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

def log(msg):
    print(f"[{ts()}] {msg}", flush=True)

def safe_count(page, sel, timeout=2000):
    try:
        return page.locator(sel).count()
    except Exception:
        return 0

def safe_bb(el, timeout=3000):
    try:
        return el.bounding_box(timeout=timeout)
    except Exception:
        return None

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()

    # ── Login ──────────────────────────────────────────────────────────────────
    log("Loading sign-in page")
    page.goto("http://localhost:5678/signin", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PWTimeout:
        pass
    log(f"Signin URL: {page.url}")

    # Wait for email input
    try:
        page.wait_for_selector("input[type='email']", timeout=8000)
        page.fill("input[type='email']", "dev@localhost.com")
        log("Email filled")
    except Exception as e:
        log(f"Email fill error: {e}")

    try:
        page.fill("input[type='password']", "DevPass2026!")
        log("Password filled")
    except Exception as e:
        log(f"Password fill error: {e}")

    # Use confirmed data-test-id for submit
    try:
        btn = page.locator("[data-test-id='form-submit-button']")
        if btn.count() > 0:
            btn.first.click()
            log("Clicked [data-test-id='form-submit-button']")
        else:
            log("form-submit-button not found; pressing Enter")
            page.keyboard.press("Enter")
    except Exception as e:
        log(f"Submit error: {e}; pressing Enter")
        page.keyboard.press("Enter")

    # Wait for navigation away from signin
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PWTimeout:
        pass
    log(f"URL after login: {page.url}")

    # If still on signin, maybe n8n dev has owner bypass via ?skipAuth
    if "/signin" in page.url:
        log("Still on signin — trying owner setup endpoint or direct nav")
        page.goto("http://localhost:5678/home/workflows", wait_until="domcontentloaded", timeout=12000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeout:
            pass
        log(f"URL after direct nav: {page.url}")

    page.wait_for_timeout(2000)

    if "/signin" in page.url or "/setup" in page.url:
        log("LOGIN FAILED — cannot access workflows page. Aborting.")
        page.screenshot(path=r"F:\mcp-brunella-core\login-fail.png", full_page=False)
        browser.close()
        raise SystemExit("Login failed")

    log("=== Logged in successfully ===")

    # ── Capture all DOM elements related to user/avatar/menu ──────────────────
    page.screenshot(path=r"F:\mcp-brunella-core\logged-in-state.png", full_page=False)
    log("Logged-in screenshot saved")

    all_interactive = page.evaluate("""() => {
        const vp = window.innerHeight;
        return Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const r = el.getBoundingClientRect();
                return r.top >= 0 && r.bottom <= vp && r.width > 0 && r.height > 0;
            })
            .map(el => ({
                tag: el.tagName,
                text: (el.innerText||'').trim().slice(0,60),
                aria: el.getAttribute('aria-label')||'',
                cls: (el.className||'').slice(0,120),
                dt: el.getAttribute('data-test-id')||'',
                x: Math.round(el.getBoundingClientRect().x),
                y: Math.round(el.getBoundingClientRect().y),
            }))
            .filter(el => el.dt || el.aria || ['BUTTON','A'].includes(el.tag)
                       || el.cls.toLowerCase().includes('avatar')
                       || el.cls.toLowerCase().includes('user')
                       || el.cls.toLowerCase().includes('menu'))
            .slice(0, 60);
    }""")
    log(f"Visible elements matching filter ({len(all_interactive)}):")
    for el in all_interactive:
        log(f"  [{el['tag']}] '{el['text'][:50]}' dt='{el['dt']}' aria='{el['aria']}' cls='{el['cls'][:70]}' pos=({el['x']},{el['y']})")

    # ── Attempt to find and click user menu ───────────────────────────────────
    MENU_SELECTORS = [
        "[data-test-id='user-menu-button']",
        "[data-test-id='nav-bar-user-avatar']",
        "[data-test-id='menu-button']",
        "[class*='userAvatar']",
        "[class*='user-avatar']",
        "[class*='UserAvatar']",
        "[class*='initials']",
        "[class*='avatar']",
        # n8n v1 uses a sidebar with a user icon at the bottom
        "nav button:last-of-type",
        "aside button:last-of-type",
    ]

    logout_found   = False
    logout_clicked = False
    logout_url     = "N/A"

    for sel in MENU_SELECTORS:
        count = safe_count(page, sel)
        if count == 0:
            continue
        log(f"Selector '{sel}' matched {count} element(s)")
        for i in range(min(count, 3)):
            el = page.locator(sel).nth(i)
            bb = safe_bb(el)
            if bb is None:
                continue
            vp_h = page.viewport_size["height"]
            if bb["y"] < 0 or bb["y"] + bb["height"] > vp_h:
                continue
            log(f"  Clicking '{sel}'[{i}] at {bb}")
            try:
                el.click(timeout=5000)
            except Exception as e:
                log(f"  Click failed: {e}")
                continue
            page.wait_for_timeout(1500)
            page.screenshot(path=r"F:\mcp-brunella-core\menu-opened.png", full_page=False)
            log("  Menu screenshot saved")

            for lt in ["Sign out", "Log out", "Logout", "Sign Out", "Log Out"]:
                try:
                    lel = page.get_by_text(lt, exact=False).first
                    lel.wait_for(state="visible", timeout=2000)
                    lbb = safe_bb(lel)
                    log(f"  Found logout: '{lt}' at {lbb}")
                    lel.click(timeout=3000)
                    page.wait_for_timeout(3000)
                    logout_url = page.url
                    logout_found = True
                    logout_clicked = True
                    log(f"  URL after logout: {logout_url}")
                    break
                except PWTimeout:
                    pass
            if logout_found:
                break
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
        if logout_found:
            break

    if not logout_found:
        log("No logout control found in viewport without scrolling")

    # Final screenshot
    page.screenshot(path=r"F:\mcp-brunella-core\final-state.png", full_page=False)
    log("Final screenshot saved")

    browser.close()

print(f"\nLogout found:   {logout_found}")
print(f"Logout clicked: {logout_clicked}")
print(f"Post-logout URL: {logout_url}")
