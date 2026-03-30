"""
Step 5 targeted script: login first, then find logout button.
Uses count() guard before bounding_box() to avoid 30-s hangs.
"""
import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

def log(msg):
    print(f"[{ts()}] {msg}", flush=True)

def safe_bb(el, timeout_ms=3000):
    """Return bounding_box or None; never hangs."""
    try:
        return el.bounding_box(timeout=timeout_ms)
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
    log("Navigating to sign-in page")
    page.goto("http://localhost:5678/signin", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PWTimeout:
        pass

    try:
        page.fill("input[type='email']", "dev@localhost.com")
        page.fill("input[type='password']", "DevPass2026!")
        page.locator("button[type='submit']").first.click()
        log("Login submitted")
    except Exception as e:
        log(f"Login fill error: {e}")

    # Wait for redirect to home
    try:
        page.wait_for_url("**/home/**", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=10000)
    except PWTimeout:
        pass
    log(f"URL after login: {page.url}")

    # If still on signin, try direct navigate
    if "/signin" in page.url:
        page.goto("http://localhost:5678/home/workflows", wait_until="domcontentloaded", timeout=12000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeout:
            pass
        log(f"URL after direct nav: {page.url}")

    page.wait_for_timeout(2000)   # let Vue render sidebar

    # ── Snapshot viewport ─────────────────────────────────────────────────────
    page.screenshot(path=r"F:\mcp-brunella-core\logout-check-state.png", full_page=False)
    log("Screenshot saved: logout-check-state.png")

    # Get all visible buttons/links with text in the current viewport
    visible_els = page.evaluate("""() => {
        const vp = window.innerHeight;
        const res = [];
        document.querySelectorAll('button, a, [role="button"], [role="menuitem"]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top >= 0 && r.bottom <= vp && r.width > 0 && r.height > 0) {
                res.push({
                    tag: el.tagName,
                    text: (el.innerText||'').trim().slice(0,80),
                    aria: el.getAttribute('aria-label')||'',
                    cls: (el.className||'').slice(0,100),
                    datatest: el.getAttribute('data-test-id')||'',
                    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)
                });
            }
        });
        return res;
    }""")
    log(f"Visible interactive elements in viewport ({len(visible_els)}):")
    for el in visible_els:
        log(f"  [{el['tag']}] text='{el['text']}' aria='{el['aria']}' datatest='{el['datatest']}' cls='{el['cls'][:60]}' pos=({el['x']},{el['y']})")

    # ── Try sidebar/avatar menu openers ───────────────────────────────────────
    MENU_SELECTORS = [
        "[data-test-id='user-menu-button']",
        "[data-test-id='nav-bar-user-avatar']",
        "[data-test-id='menu-button']",
        "[class*='userAvatar']",
        "[class*='user-avatar']",
        "[class*='UserAvatar']",
        "[class*='initials']",
        "[class*='avatar']",
    ]

    logout_found   = False
    logout_clicked = False
    logout_url     = "N/A"

    for sel in MENU_SELECTORS:
        try:
            count = page.locator(sel).count()
            if count == 0:
                continue
            # Check bounding boxes of each match
            for i in range(count):
                el = page.locator(sel).nth(i)
                bb = safe_bb(el)
                if bb is None:
                    continue
                vp_h = page.viewport_size["height"]
                if bb["y"] < 0 or bb["y"] + bb["height"] > vp_h:
                    continue
                log(f"Opening menu via '{sel}'[{i}] at {bb}")
                el.click()
                page.wait_for_timeout(1500)
                page.screenshot(path=r"F:\mcp-brunella-core\menu-opened.png", full_page=False)
                log("Menu screenshot saved")

                # Check for logout
                for lt in ["Sign out", "Log out", "Logout", "Sign Out", "Log Out"]:
                    lels = page.get_by_text(lt, exact=False)
                    try:
                        lels.first.wait_for(state="visible", timeout=2000)
                        lbb = safe_bb(lels.first)
                        log(f"  Found logout text '{lt}' at {lbb}")
                        lels.first.click()
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
                page.wait_for_timeout(400)
            if logout_found:
                break
        except Exception as e:
            log(f"  '{sel}' error: {e}")

    if not logout_found:
        log("No logout control found in current viewport without scrolling")

    browser.close()

print("\n--- LOGOUT STEP RESULT ---")
print(f"Logout found:   {logout_found}")
print(f"Logout clicked: {logout_clicked}")
print(f"Post-logout URL: {logout_url}")
print("Done.")
