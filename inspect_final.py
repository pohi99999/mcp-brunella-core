"""
Exact working login + sidebar expand + logout check.
"""
import datetime
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

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()

    # ── Exact working login sequence from inspect_logout4.py ─────────────────
    log("Loading sign-in page")
    page.goto("http://localhost:5678/signin", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PWTimeout:
        pass

    try:
        page.wait_for_selector("input[type='email']", timeout=8000)
        email_input = page.locator("input[type='email']")
        email_input.click()
        page.wait_for_timeout(200)
        email_input.fill("")
        page.keyboard.type("dev@localhost.com", delay=30)
        log("Email typed")
    except Exception as e:
        log(f"Email error: {e}")

    try:
        page.keyboard.press("Tab")
        page.wait_for_timeout(100)
        pw_input = page.locator("input[type='password']")
        pw_input.fill("")
        page.keyboard.type("DevPass2026!", delay=30)
        log("Password typed")
    except Exception as e:
        log(f"Password error: {e}")

    page.wait_for_timeout(500)

    submit_btn = page.locator("[data-test-id='form-submit-button']")
    if submit_btn.count() > 0:
        disabled = submit_btn.first.get_attribute("disabled")
        log(f"Submit disabled attr: {disabled!r}")
        try:
            submit_btn.first.click(force=True)
            log("Submit clicked")
        except Exception as e:
            log(f"Submit click error: {e}")
    else:
        page.keyboard.press("Enter")
        log("Pressed Enter to submit")

    try:
        page.wait_for_url(lambda u: "/signin" not in u, timeout=15000)
        log("Navigated away from signin!")
    except PWTimeout:
        log("Still on signin after 15s")

    log(f"URL after login: {page.url}")

    if "/signin" in page.url:
        page.goto("http://localhost:5678/home/workflows", wait_until="domcontentloaded", timeout=12000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeout:
            pass
        log(f"URL after direct nav: {page.url}")

    if "/signin" in page.url or "/setup" in page.url:
        page.screenshot(path=r"F:\mcp-brunella-core\login-failed-final.png", full_page=False)
        log("LOGIN FAILED - saving screenshot")
        browser.close()
        raise SystemExit("Login failed")

    page.wait_for_timeout(2000)
    log(f"=== On workflows page: {page.url} ===")

    # ── Extract workflow cards ─────────────────────────────────────────────────
    wf_cards = page.evaluate("""() => {
        const vp = window.innerHeight;
        return Array.from(document.querySelectorAll('[data-test-id="resources-list-item-workflow"]'))
            .map(card => {
                const r = card.getBoundingClientRect();
                const name = (card.querySelector('[data-test-id="workflow-card-name"]')||{}).innerText||'';
                const badge = (card.querySelector('[data-test-id="card-badge"]')||{}).innerText||'';
                const activator = card.querySelector('[data-test-id="workflow-card-activator"]');
                const active = activator ? activator.getAttribute('aria-checked') : null;
                return { name: name.trim(), badge: badge.trim(), active, y: Math.round(r.y), visible: r.top >= 0 && r.bottom <= vp };
            });
    }""")
    log(f"Workflow cards ({len(wf_cards)}):")
    for w in wf_cards:
        log(f"  [{'VIS' if w['visible'] else 'OOV'}] '{w['name']}'  badge='{w['badge']}'  active={w['active']}")

    # ── Expand sidebar ─────────────────────────────────────────────────────────
    log("\nToggling sidebar to expand")
    toggle_sel = "button[aria-label='Toggle sidebar']"
    toggle_count = page.locator(toggle_sel).count()
    log(f"Toggle sidebar buttons: {toggle_count}")

    if toggle_count > 0:
        page.locator(toggle_sel).first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=r"F:\mcp-brunella-core\sidebar-expanded.png", full_page=False)
        log("Sidebar expanded screenshot saved")

    # ── Full sidebar bottom-section dump ──────────────────────────────────────
    sidebar_bottom = page.evaluate("""() => {
        const vp = window.innerHeight;
        const aside = document.querySelector('#sidebar, aside, [class*="sidebar"]');
        if (!aside) return {html: 'NO SIDEBAR', items: []};
        const items = Array.from(aside.querySelectorAll('button, a, [role="button"], [class*="user"], [class*="avatar"]'))
            .map(el => {
                const r = el.getBoundingClientRect();
                return {
                    tag: el.tagName,
                    text: (el.innerText||'').trim().slice(0,60),
                    aria: el.getAttribute('aria-label')||'',
                    dt: el.getAttribute('data-test-id')||'',
                    cls: (el.className||'').slice(0,80),
                    y: Math.round(r.y),
                    inVP: r.top >= 0 && r.bottom <= vp && r.width > 0
                };
            });
        return { items, bottomHtml: aside.innerHTML.slice(-3000) };
    }""")
    log(f"Sidebar items ({len(sidebar_bottom['items'])}):")
    for el in sidebar_bottom['items']:
        log(f"  [{'IN-VP' if el['inVP'] else 'OUT   '}] [{el['tag']}] '{el['text']}' aria='{el['aria']}' dt='{el['dt']}' cls='{el['cls'][:50]}' y={el['y']}")

    log(f"Sidebar bottom HTML:\n{sidebar_bottom['bottomHtml'][:2000]}")

    # ── Look for user section in the expanded sidebar ─────────────────────────
    logout_found   = False
    logout_clicked = False
    logout_url     = "N/A"

    # Try all sidebar items in viewport
    vp_h = page.viewport_size["height"]
    for el_info in sidebar_bottom['items']:
        if not el_info['inVP']:
            continue
        aria = el_info['aria'].lower()
        text = el_info['text'].lower()
        cls  = el_info['cls'].lower()
        dt   = el_info['dt'].lower()
        # Skip obvious non-user items
        if any(x in aria for x in ['toggle', 'command', 'add new', 'overview', 'chat', 'template', 'insight', 'help', 'setting', 'filters', 'folder']):
            continue
        if any(x in text for x in ['workflow', 'credential', 'execution', 'variable', 'data table', 'create', 'remove filter']):
            continue
        # Candidate items that might be user menu
        if el_info['dt'] or 'user' in cls or 'avatar' in cls or 'initials' in cls or 'menu' in dt:
            log(f"Candidate user menu: [{el_info['tag']}] '{el_info['text']}' aria='{el_info['aria']}' dt='{el_info['dt']}'")
            try:
                sel = f"[data-test-id='{el_info['dt']}']" if el_info['dt'] else f"[aria-label='{el_info['aria']}']"
                el = page.locator(sel).first
                el.click(timeout=3000)
                page.wait_for_timeout(1200)
                page.screenshot(path=r"F:\mcp-brunella-core\potential-user-menu.png", full_page=False)
                for lt in ["Sign out", "Log out", "Logout"]:
                    try:
                        lel = page.get_by_text(lt, exact=False).first
                        lel.wait_for(state="visible", timeout=2000)
                        log(f"  LOGOUT FOUND: '{lt}'")
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
            except Exception as e:
                log(f"  Error clicking: {e}")

    if not logout_found:
        log("No logout found via any method without scrolling")

    page.screenshot(path=r"F:\mcp-brunella-core\final-step5b.png", full_page=False)
    log("Final screenshot saved")
    browser.close()

print(f"\n--- RESULTS ---")
print(f"logout_found:   {logout_found}")
print(f"logout_clicked: {logout_clicked}")
print(f"logout_url:     {logout_url}")
print("Workflow cards:")
for w in wf_cards:
    print(f"  {'VIS' if w['visible'] else 'OOV'}: {w['name']} | badge={w['badge']} | active={w['active']}")
