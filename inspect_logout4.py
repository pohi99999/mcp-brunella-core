"""
Login with keyboard-level input (page.type) to properly trigger Vue reactivity,
then probe for logout controls and dump the full sidebar DOM.
"""
import datetime, time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

def log(msg):
    print(f"[{ts()}] {msg}", flush=True)

def safe_bb(el, timeout=3000):
    try:
        return el.bounding_box(timeout=timeout)
    except Exception:
        return None

def try_login(page):
    """Attempt login; return True if we end up authenticated."""
    log("Navigating to /signin")
    page.goto("http://localhost:5678/signin", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PWTimeout:
        pass

    # Click email field, clear, type
    try:
        email_input = page.locator("input[type='email']")
        email_input.click()
        page.wait_for_timeout(200)
        email_input.fill("")
        page.keyboard.type("dev@localhost.com", delay=30)
        log("Email typed")
    except Exception as e:
        log(f"Email type error: {e}")

    # Tab to password, type
    try:
        page.keyboard.press("Tab")
        page.wait_for_timeout(100)
        pw_input = page.locator("input[type='password']")
        pw_input.fill("")
        page.keyboard.type("DevPass2026!", delay=30)
        log("Password typed")
    except Exception as e:
        log(f"Password type error: {e}")

    page.wait_for_timeout(500)  # let Vue validation run

    # Check submit button state
    submit_btn = page.locator("[data-test-id='form-submit-button']")
    if submit_btn.count() > 0:
        disabled = submit_btn.first.get_attribute("disabled")
        log(f"Submit button disabled attr: {disabled!r}")
        try:
            submit_btn.first.click(force=True)
            log("Submit clicked (force=True)")
        except Exception as e:
            log(f"Submit click error: {e}")
    else:
        log("Submit btn not found; pressing Enter")
        page.keyboard.press("Enter")

    # Wait up to 15s for navigation away from /signin
    try:
        page.wait_for_url(lambda u: "/signin" not in u, timeout=15000)
        log("Navigated away from signin!")
        return True
    except PWTimeout:
        pass

    # Check URL
    log(f"URL 15s after submit: {page.url}")

    # Dump any error messages
    try:
        errors = page.locator("[class*='error'], [class*='Error'], .n8n-text--danger, [role=alert]").all()
        for err in errors[:5]:
            log(f"  Error text: '{err.inner_text()}'")
    except Exception:
        pass

    return "/signin" not in page.url

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()

    logged_in = try_login(page)
    log(f"Logged in: {logged_in}, URL: {page.url}")

    if not logged_in:
        # n8n owner bypass: try visiting /setup or checking instance type
        log("Trying /setup route (first-time owner setup)")
        page.goto("http://localhost:5678/setup", wait_until="domcontentloaded", timeout=10000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeout:
            pass
        log(f"Setup URL: {page.url}")
        page.screenshot(path=r"F:\mcp-brunella-core\setup-page.png", full_page=False)

        # Try /home/workflows - might work if n8n is in owner-skip mode
        page.goto("http://localhost:5678/home/workflows", wait_until="domcontentloaded", timeout=12000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeout:
            pass
        log(f"Workflows direct URL: {page.url}")
        logged_in = "/signin" not in page.url

    if not logged_in:
        page.screenshot(path=r"F:\mcp-brunella-core\not-logged-in.png", full_page=False)
        log("CANNOT LOG IN — all methods failed")
        browser.close()
        raise SystemExit("Login failed")

    page.wait_for_timeout(2000)
    log("=== Successfully on authenticated page ===")
    page.screenshot(path=r"F:\mcp-brunella-core\authenticated-home.png", full_page=False)

    # ── Full DOM dump of everything that has a data-test-id ────────────────────
    dom_items = page.evaluate("""() => {
        const all = Array.from(document.querySelectorAll('[data-test-id]'));
        return all.map(el => ({
            tag: el.tagName,
            dt: el.getAttribute('data-test-id'),
            text: (el.innerText||'').trim().slice(0,80),
            cls: (el.className||'').slice(0,80),
        }));
    }""")
    log(f"All data-test-id elements in DOM ({len(dom_items)}):")
    for el in dom_items[:60]:
        log(f"  [{el['tag']}] dt='{el['dt']}' text='{el['text']}' cls='{el['cls']}'")

    # ── Sidebar full dump ──────────────────────────────────────────────────────
    sidebar_html = page.evaluate("""() => {
        const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
        return sidebar ? sidebar.outerHTML.slice(0, 3000) : 'NO SIDEBAR FOUND';
    }""")
    log(f"Sidebar HTML (first 3000):\n{sidebar_html}")

    # ── Find logout controls ───────────────────────────────────────────────────
    logout_found = False
    logout_clicked = False
    logout_url = "N/A"

    # All visible interactive elements
    vis = page.evaluate("""() => {
        const vp = window.innerHeight;
        return Array.from(document.querySelectorAll('button, a, [role="button"]'))
            .filter(el => {
                const r = el.getBoundingClientRect();
                return r.top >= 0 && r.bottom <= vp && r.width > 0 && r.height > 0;
            })
            .map(el => ({
                tag: el.tagName,
                text: (el.innerText||'').trim().slice(0,60),
                aria: el.getAttribute('aria-label')||'',
                dt: el.getAttribute('data-test-id')||'',
                cls: (el.className||'').slice(0,80),
                y: Math.round(el.getBoundingClientRect().y),
            }));
    }""")
    log(f"Visible buttons/links ({len(vis)}):")
    for el in vis:
        log(f"  [{el['tag']}] '{el['text']}' aria='{el['aria']}' dt='{el['dt']}' cls='{el['cls'][:50]}' y={el['y']}")

    # Try clicking avatar/user menu buttons in viewport
    MENU_TRY = [
        "[data-test-id='user-menu-button']",
        "[data-test-id='menu-button']",
        "[data-test-id='nav-bar-user-avatar']",
        "[class*='userAvatar']",
        "[class*='user-avatar']",
        "[class*='UserAvatar']",
        "[class*='initials']",
        "[class*='avatar']",
    ]
    vp_h = page.viewport_size["height"]

    for sel in MENU_TRY:
        try:
            count = page.locator(sel).count()
        except Exception:
            count = 0
        if count == 0:
            continue
        log(f"Trying menu: '{sel}' ({count} matches)")
        for i in range(min(count, 3)):
            el = page.locator(sel).nth(i)
            bb = safe_bb(el)
            if bb is None or bb["y"] < 0 or bb["y"] + bb["height"] > vp_h:
                continue
            log(f"  Clicking '{sel}'[{i}] at {bb}")
            el.click(timeout=5000)
            page.wait_for_timeout(1500)
            page.screenshot(path=r"F:\mcp-brunella-core\menu-opened.png", full_page=False)
            log("  Menu screenshot saved")

            for lt in ["Sign out", "Log out", "Logout", "Sign Out", "Log Out"]:
                try:
                    lel = page.get_by_text(lt, exact=False).first
                    lel.wait_for(state="visible", timeout=2000)
                    log(f"  Found logout: '{lt}'")
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
        log("No logout control found in current viewport without scrolling")

    page.screenshot(path=r"F:\mcp-brunella-core\final-state.png", full_page=False)
    log("Final screenshot saved")
    browser.close()

print(f"\n--- LOGOUT RESULT ---")
print(f"logout_found:   {logout_found}")
print(f"logout_clicked: {logout_clicked}")
print(f"logout_url:     {logout_url}")
