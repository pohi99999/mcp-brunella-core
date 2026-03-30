import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

def log(msg):
    print(f"[{ts()}] {msg}", flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()

    page.goto("http://localhost:5678/home/workflows", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except PWTimeout:
        pass
    log(f"URL: {page.url}")

    # Snapshot all visible interactive elements
    visible = page.evaluate("""() => {
        const vp = window.innerHeight;
        const results = [];
        document.querySelectorAll('button, a, [role="button"], [class*="avatar"], [class*="user"], [class*="menu"], [class*="profile"]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top >= 0 && r.bottom <= vp && r.width > 0) {
                const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
                const cls = el.className || '';
                if (txt || cls.includes('avatar') || cls.includes('user') || cls.includes('menu')) {
                    results.push({tag: el.tagName, text: txt.slice(0,80), cls: cls.slice(0,120)});
                }
            }
        });
        return results;
    }""")
    log(f"Visible interactive elements ({len(visible)}):")
    for el in visible:
        log(f"  {el['tag']} text='{el['text']}' cls='{el['cls']}'")

    page.screenshot(path=r"F:\mcp-brunella-core\workflows-list-logout-check.png", full_page=False)
    log("Recon screenshot saved")

    # Try known n8n user-menu selectors
    MENU_TRY = [
        "[data-test-id='user-menu-button']",
        "[data-test-id='nav-bar-user-avatar']",
        "[data-test-id='sidebar-collapse-button']",
        "button[class*='initials']",
        "[class*='UserAvatar']",
        "[class*='user-avatar']",
        "nav [class*='avatar']",
        "aside [class*='avatar']",
        "[class*='sidebar'] button:last-of-type",
    ]
    logout_found = False
    logout_url = "N/A"

    for sel in MENU_TRY:
        try:
            el = page.locator(sel).first
            bb = el.bounding_box()
            if bb is None:
                continue
            log(f"Trying menu opener: '{sel}' bbox={bb}")
            el.click(timeout=3000)
            page.wait_for_timeout(1500)
            page.screenshot(path=r"F:\mcp-brunella-core\menu-opened.png", full_page=False)
            log("Menu-opened screenshot saved")

            # Check for logout option
            for logout_text in ["Sign out", "Log out", "Logout", "Sign Out", "Log Out"]:
                try:
                    lel = page.get_by_text(logout_text, exact=True).first
                    if lel.is_visible(timeout=2000):
                        log(f"Logout found: '{logout_text}'")
                        lel.click()
                        page.wait_for_timeout(3000)
                        logout_url = page.url
                        log(f"URL after logout: {logout_url}")
                        logout_found = True
                        break
                except Exception:
                    pass
            if logout_found:
                break
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except Exception as e:
            log(f"  '{sel}' error: {e}")

    if not logout_found:
        log("No logout found via any menu selector")

    # Dump ALL buttons in DOM with data-test-id
    all_btns = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('[data-test-id], button, [role=menuitem]'))
            .map(b => ({
                text: (b.innerText||'').trim().slice(0,60),
                aria: b.getAttribute('aria-label')||'',
                id: b.id||'',
                datatest: b.getAttribute('data-test-id')||''
            }))
            .filter(b => b.text || b.aria || b.datatest)
            .slice(0, 40);
    }""")
    log(f"All data-test-id / button elements ({len(all_btns)}):")
    for b in all_btns:
        log(f"  text='{b['text']}' aria='{b['aria']}' id='{b['id']}' data-test-id='{b['datatest']}'")

    browser.close()

print("\nLogout found:", logout_found)
print("Post-logout URL:", logout_url)
print("Done.")
