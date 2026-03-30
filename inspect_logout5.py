"""
Final check: expand sidebar to find user/logout control; report full findings.
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

def login(page):
    page.goto("http://localhost:5678/signin", wait_until="domcontentloaded", timeout=15000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except PWTimeout:
        pass
    page.locator("input[type='email']").click()
    page.keyboard.type("dev@localhost.com", delay=30)
    page.keyboard.press("Tab")
    page.locator("input[type='password']").fill("")
    page.keyboard.type("DevPass2026!", delay=30)
    page.wait_for_timeout(500)
    try:
        page.locator("[data-test-id='form-submit-button']").first.click(force=True)
    except Exception:
        page.keyboard.press("Enter")
    try:
        page.wait_for_url(lambda u: "/signin" not in u, timeout=15000)
    except PWTimeout:
        pass
    log(f"Post-login URL: {page.url}")
    return "/signin" not in page.url

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    )
    page = ctx.new_page()
    ok = login(page)
    log(f"Logged in: {ok}")
    if not ok:
        browser.close()
        raise SystemExit("login failed")

    page.wait_for_timeout(2000)
    page.screenshot(path=r"F:\mcp-brunella-core\sidebar-collapsed.png", full_page=False)
    log("Collapsed sidebar screenshot saved")

    # ── Find all workflow cards (proper selectors now known) ──────────────────
    log("\n=== WORKFLOW CARDS EXTRACTION ===")
    wf_cards = page.evaluate("""() => {
        const vp = window.innerHeight;
        const cards = Array.from(document.querySelectorAll('[data-test-id="resources-list-item-workflow"]'));
        return cards.map(card => {
            const r = card.getBoundingClientRect();
            const nameEl = card.querySelector('[data-test-id="workflow-card-name"]');
            const name = nameEl ? nameEl.innerText.trim() : '';
            // status = active badge (n8n shows no badge for inactive, 'Active' for active)
            const toggleEl = card.querySelector('[data-test-id="workflow-card-activator"]');
            const statusBadge = card.querySelector('[data-test-id="card-badge"]');
            const badgeText = statusBadge ? statusBadge.innerText.trim() : '';
            // active state from aria or class
            const isActive = toggleEl ? (toggleEl.getAttribute('aria-checked') === 'true') : null;
            return {
                name,
                badge: badgeText,
                isActive,
                y: Math.round(r.y),
                h: Math.round(r.height),
                visible: r.top >= 0 && r.bottom <= vp
            };
        });
    }""")
    log(f"Workflow cards found ({len(wf_cards)}):")
    for wf in wf_cards:
        vis = "VISIBLE" if wf['visible'] else f"offscreen(y={wf['y']})"
        log(f"  [{vis}] '{wf['name']}'  badge='{wf['badge']}'  active={wf['isActive']}")

    # ── Expand sidebar and look for user/logout ───────────────────────────────
    log("\n=== SIDEBAR EXPAND & LOGOUT CHECK ===")

    # Toggle sidebar (aria='Toggle sidebar')
    toggle = page.locator("button[aria-label='Toggle sidebar']")
    if toggle.count() > 0:
        bb = safe_bb(toggle.first)
        log(f"Toggle sidebar button found at {bb}")
        toggle.first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=r"F:\mcp-brunella-core\sidebar-expanded.png", full_page=False)
        log("Expanded sidebar screenshot saved")
    else:
        log("Toggle sidebar button not found")

    # Now look for user/avatar in the expanded sidebar
    user_items = page.evaluate("""() => {
        const vp = window.innerHeight;
        return Array.from(document.querySelectorAll('*')).filter(el => {
            const cls = (el.className||'').toLowerCase();
            const dt = el.getAttribute('data-test-id')||'';
            const txt = (el.innerText||'').trim().toLowerCase();
            return cls.includes('avatar') || cls.includes('user') || dt.includes('user') || dt.includes('logout') || txt.includes('sign out') || txt.includes('log out');
        }).map(el => {
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName,
                text: (el.innerText||'').trim().slice(0,60),
                dt: el.getAttribute('data-test-id')||'',
                cls: (el.className||'').slice(0,80),
                x: Math.round(r.x), y: Math.round(r.y),
                visible: r.top >= 0 && r.bottom <= vp && r.width > 0
            };
        }).slice(0, 20);
    }""")
    log(f"User/avatar/logout elements found ({len(user_items)}):")
    for el in user_items:
        log(f"  [{el['tag']}] '{el['text']}' dt='{el['dt']}' cls='{el['cls'][:50]}' pos=({el['x']},{el['y']}) visible={el['visible']}")

    # Try clicking the user section / avatar in the expanded sidebar
    logout_found   = False
    logout_clicked = False
    logout_url     = "N/A"

    vp_h = page.viewport_size["height"]
    for el_info in user_items:
        if not el_info['visible']:
            continue
        try:
            # Find the actual element
            sel = f"[data-test-id='{el_info['dt']}']" if el_info['dt'] else None
            if not sel:
                continue
            el = page.locator(sel).first
            log(f"Clicking user element: {sel}")
            el.click(timeout=3000)
            page.wait_for_timeout(1200)
            page.screenshot(path=r"F:\mcp-brunella-core\user-menu-opened.png", full_page=False)
            for lt in ["Sign out", "Log out", "Logout"]:
                try:
                    lel = page.get_by_text(lt, exact=False).first
                    lel.wait_for(state="visible", timeout=2000)
                    log(f"Logout option '{lt}' found!")
                    lel.click(timeout=3000)
                    page.wait_for_timeout(3000)
                    logout_url = page.url
                    logout_found = True
                    logout_clicked = True
                    log(f"URL after logout: {logout_url}")
                    break
                except PWTimeout:
                    pass
            if logout_found:
                break
            page.keyboard.press("Escape")
        except Exception as e:
            log(f"  Click error: {e}")

    # If still not found, try the bottom of the sidebar directly
    if not logout_found:
        log("Trying bottom sidebar buttons (last items)")
        bottom_btns = page.evaluate("""() => {
            const vp = window.innerHeight;
            const aside = document.querySelector('aside, [id="sidebar"]');
            if (!aside) return [];
            const btns = Array.from(aside.querySelectorAll('button, a[href], [role="button"]'));
            return btns.map(b => {
                const r = b.getBoundingClientRect();
                return {
                    tag: b.tagName,
                    text: (b.innerText||'').trim().slice(0,60),
                    aria: b.getAttribute('aria-label')||'',
                    cls: (b.className||'').slice(0,60),
                    dt: b.getAttribute('data-test-id')||'',
                    x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height),
                    inViewport: r.top >= 0 && r.bottom <= vp && r.width > 0
                };
            }).sort((a,b) => b.y - a.y);  // sort by y descending (bottom-most first)
        }""")
        log(f"Sidebar buttons sorted by Y position (bottom-most first, {len(bottom_btns)}):")
        for btn in bottom_btns[:15]:
            log(f"  [{btn['tag']}] '{btn['text']}' aria='{btn['aria']}' dt='{btn['dt']}' pos=({btn['x']},{btn['y']}) inViewport={btn['inViewport']}")

    # Screenshot of final state
    page.screenshot(path=r"F:\mcp-brunella-core\final-step5.png", full_page=False)
    log("Final screenshot: final-step5.png")
    browser.close()

print(f"\n--- RESULTS ---")
print(f"logout_found:   {logout_found}")
print(f"logout_clicked: {logout_clicked}")
print(f"logout_url:     {logout_url}")
