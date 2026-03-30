"""
Automated inspection of the local n8n-like web app at http://localhost:5678.
Steps:
  1. Navigate to /home/workflows (fallback /workflows)
  2. Handle login if needed
  3. Extract visible workflow cards / table rows (no scroll)
  4. Click "Brunella Bookkeeping Email Intake Scaffold" if visible
  5. Look for logout control in current viewport; click if found
  6. Capture screenshots
"""

import datetime, json, re, sys, pathlib
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL   = "http://localhost:5678"
CREDS      = {"email": "dev@localhost.com", "password": "DevPass2026!"}
OUT_DIR    = pathlib.Path(r"F:\mcp-brunella-core")
LOG        = []

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]

def log(msg):
    entry = f"[{ts()}] {msg}"
    print(entry, flush=True)
    LOG.append(entry)

def current_url(page):
    return page.url

def save_shot(page, name):
    path = OUT_DIR / name
    try:
        page.screenshot(path=str(path), full_page=False)
        log(f"Screenshot saved → {path}")
        return str(path)
    except Exception as e:
        log(f"Screenshot FAILED ({name}): {e}")
        return None

def wait_stable(page, timeout=15000):
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except PWTimeout:
        pass

# ── main ──────────────────────────────────────────────────────────────────────
with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
    )
    page = context.new_page()

    # ── STEP 1: Navigate ──────────────────────────────────────────────────────
    log("STEP 1 – Navigate to /home/workflows")
    try:
        page.goto(f"{BASE_URL}/home/workflows", wait_until="domcontentloaded", timeout=20000)
    except PWTimeout:
        log("Initial goto timed-out; continuing anyway")
    wait_stable(page)
    log(f"URL after navigate: {current_url(page)}")
    dom_snap = page.content()[:2000]
    log(f"DOM excerpt (first 2000 chars):\n{dom_snap}")

    # ── STEP 2: Login if needed ───────────────────────────────────────────────
    def is_login_page():
        url = current_url(page)
        return (
            "/signin" in url
            or "/login" in url
            or "/setup" in url
            or page.locator("input[type='password']").count() > 0
        )

    if is_login_page():
        log("STEP 2 – Login page detected; attempting login")
        # Discover email / password inputs
        email_sel    = "input[type='email'], input[name*='email' i], input[placeholder*='email' i]"
        password_sel = "input[type='password']"

        try:
            page.wait_for_selector(email_sel, timeout=8000)
            page.fill(email_sel, CREDS["email"])
            log(f"Filled email: {CREDS['email']}")
        except PWTimeout:
            log("WARNING: email input not found; trying username")
            try:
                page.fill("input[name*='user' i]", CREDS["email"])
            except Exception:
                pass

        try:
            page.fill(password_sel, CREDS["password"])
            log("Filled password")
        except Exception as e:
            log(f"ERROR filling password: {e}")

        # Submit
        try:
            submit = page.locator(
                "button[type='submit'], button:has-text('Sign in'), "
                "button:has-text('Log in'), button:has-text('Continue')"
            ).first
            submit.click()
            log("Clicked submit button")
        except Exception as e:
            log(f"Could not find submit button ({e}); pressing Enter")
            page.keyboard.press("Enter")

        wait_stable(page, timeout=20000)
        log(f"URL after login attempt: {current_url(page)}")

        # If still on login / setup, try navigating manually
        if is_login_page():
            log("Still on login/setup page; trying direct navigation again")
            try:
                page.goto(f"{BASE_URL}/home/workflows", wait_until="domcontentloaded", timeout=15000)
                wait_stable(page)
            except Exception:
                pass
            log(f"URL after re-navigate: {current_url(page)}")
    else:
        log("STEP 2 – No login page detected; already authenticated or no auth needed")

    log(f"URL entering Step 3: {current_url(page)}")

    # ── STEP 3: Extract visible workflow rows / cards ─────────────────────────
    log("STEP 3 – Extracting visible workflow names + status badges")

    # Take a recon screenshot of current state
    save_shot(page, "recon-before-extract.png")

    # Possible selectors for workflow items in n8n-style UIs
    WORKFLOW_ROW_SELECTORS = [
        "tr[class*='workflow']",
        "tr[data-test-id*='workflow']",
        "[data-test-id='workflow-card']",
        "[class*='workflow-card']",
        "[class*='WorkflowCard']",
        ".n8n-card",
        "table tbody tr",
        "[class*='list-item']",
        "[data-id]",                        # generic data-id items
    ]

    workflows_found = []
    used_selector   = None

    for sel in WORKFLOW_ROW_SELECTORS:
        try:
            items = page.locator(sel).all()
            if items:
                log(f"Selector '{sel}' matched {len(items)} element(s)")
                used_selector = sel
                break
        except Exception:
            pass

    if used_selector:
        items = page.locator(used_selector).all()
        vp_height = page.viewport_size["height"]   # 900px

        for item in items:
            try:
                bbox = item.bounding_box()
                if bbox is None:
                    continue
                # Only include items fully visible without scrolling
                if bbox["y"] + bbox["height"] > vp_height:
                    continue

                name   = item.locator("[class*='name'], [class*='title'], td:first-child, [data-test-id*='name']").first.inner_text(timeout=2000).strip()
                status = ""
                try:
                    status = item.locator(
                        "[class*='badge'], [class*='status'], [class*='tag'], "
                        "[class*='active'], [class*='inactive'], [data-test-id*='status']"
                    ).first.inner_text(timeout=2000).strip()
                except Exception:
                    pass

                if name:
                    workflows_found.append({"name": name, "status": status})
                    log(f"  Workflow: '{name}'  status='{status}'")
            except Exception as e:
                log(f"  Row extraction error: {e}")
    else:
        log("No workflow rows found with known selectors; falling back to inner-text scan")
        # Grab all visible text nodes that might be workflow names
        all_text = page.evaluate("""() => {
            const vp = window.innerHeight;
            const results = [];
            document.querySelectorAll('*').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.top >= 0 && r.bottom <= vp && r.width > 0) {
                    const t = (el.innerText || '').trim();
                    if (t && t.length > 5 && t.length < 120 && !results.includes(t)) {
                        results.push(t);
                    }
                }
            });
            return results.slice(0, 40);
        }""")
        log(f"Visible text nodes (fallback): {json.dumps(all_text, indent=2)}")

    # ── STEP 3b: Alternative DOM-scrape of all visible workflow names ─────────
    log("STEP 3b – DOM-scrape for workflow names (comprehensive)")
    wf_data = page.evaluate("""() => {
        const vp = window.innerHeight;
        // Try table rows
        const rows = Array.from(document.querySelectorAll('tr, [class*="workflow"], [class*="Workflow"]'));
        const items = [];
        rows.forEach(row => {
            const r = row.getBoundingClientRect();
            if (r.top < 0 || r.bottom > vp) return;
            const nameEl = row.querySelector('[class*="name"], [class*="title"], td, [class*="Name"], [class*="Title"]');
            const name = nameEl ? (nameEl.innerText || '').trim() : (row.innerText || '').trim().split('\\n')[0];
            const badgeEl = row.querySelector('[class*="badge"], [class*="status"], [class*="active"], [class*="inactive"], [class*="tag"]');
            const status = badgeEl ? (badgeEl.innerText || '').trim() : '';
            if (name && name.length > 3 && name.length < 200) {
                items.push({name, status});
            }
        });
        return items.slice(0, 30);
    }""")
    log(f"DOM-scraped items: {json.dumps(wf_data, indent=2)}")

    # Merge
    all_names = set(w["name"] for w in workflows_found)
    for w in wf_data:
        if w["name"] not in all_names:
            workflows_found.append(w)
            all_names.add(w["name"])

    log(f"Total unique workflows captured: {len(workflows_found)}")

    # Save workflows list screenshot
    workflows_list_shot = save_shot(page, "workflows-list.png")

    # ── STEP 4: Click Brunella workflow if visible ────────────────────────────
    BRUNELLA = "Brunella Bookkeeping Email Intake Scaffold"
    log(f"STEP 4 – Looking for '{BRUNELLA}'")

    brunella_canvas_shot = None
    brunella_editor_visible = False
    brunella_nodes_visible  = False

    try:
        # Try exact text match first
        brunella_link = page.get_by_text(BRUNELLA, exact=True).first
        bb = brunella_link.bounding_box()
        log(f"Found Brunella element, bounding box: {bb}")
        brunella_link.click()
        log("Clicked Brunella workflow")

        # Wait longer for canvas
        wait_stable(page, timeout=30000)
        page.wait_for_timeout(3000)   # extra settle
        log(f"URL after clicking Brunella: {current_url(page)}")

        # Check for editor/canvas root
        CANVAS_SELECTORS = [
            "#app",
            "[data-test-id='canvas']",
            "[class*='canvas']",
            "[class*='Canvas']",
            "[class*='editor']",
            "[class*='Editor']",
            ".graph-container",
            "svg",
        ]
        for csel in CANVAS_SELECTORS:
            try:
                count = page.locator(csel).count()
                if count > 0:
                    log(f"Canvas/editor root found with selector '{csel}' (count={count})")
                    brunella_editor_visible = True
                    break
            except Exception:
                pass

        # Check for nodes
        NODE_SELECTORS = [
            "[data-test-id*='node']",
            "[class*='node']",
            "[class*='Node']",
            "g.node",
            ".vue-flow__node",
            "[class*='workflow-node']",
        ]
        for nsel in NODE_SELECTORS:
            try:
                count = page.locator(nsel).count()
                if count > 0:
                    log(f"Nodes found with selector '{nsel}' (count={count})")
                    brunella_nodes_visible = True
                    break
            except Exception:
                pass

        brunella_canvas_shot = save_shot(page, "workflows-brunella-intake-canvas.png")

        # Navigate back to workflows list
        log("Navigating back to workflows list")
        page.go_back()
        wait_stable(page)
        log(f"URL after back: {current_url(page)}")

    except Exception as e:
        log(f"Brunella workflow not found or click failed: {e}")
        log("Trying partial text match…")
        try:
            partial = page.get_by_text("Brunella", exact=False).first
            bb = partial.bounding_box()
            log(f"Partial match bounding box: {bb}")
            if bb and bb["y"] + bb["height"] <= page.viewport_size["height"]:
                partial.click()
                wait_stable(page, timeout=25000)
                page.wait_for_timeout(3000)
                log(f"URL after partial-match click: {current_url(page)}")
                brunella_canvas_shot = save_shot(page, "workflows-brunella-intake-canvas.png")
                page.go_back()
                wait_stable(page)
            else:
                log("Brunella not visible in current viewport without scrolling")
        except Exception as e2:
            log(f"Partial match also failed: {e2}")

    # ── STEP 5: Look for logout control (no scrolling) ────────────────────────
    log("STEP 5 – Searching for logout/sign-out control in current viewport")
    logout_found   = False
    logout_clicked = False
    post_logout_state = "N/A"

    LOGOUT_CANDIDATES = [
        "button:has-text('Sign out')",
        "button:has-text('Log out')",
        "button:has-text('Logout')",
        "a:has-text('Sign out')",
        "a:has-text('Log out')",
        "[data-test-id*='logout']",
        "[data-test-id*='signout']",
        "[class*='logout']",
        "[class*='signout']",
    ]

    for cand in LOGOUT_CANDIDATES:
        try:
            el = page.locator(cand).first
            bb = el.bounding_box()
            if bb and bb["y"] >= 0 and bb["y"] + bb["height"] <= page.viewport_size["height"]:
                log(f"Logout control found: '{cand}' at {bb}")
                logout_found = True
                el.click()
                log("Clicked logout control")
                wait_stable(page, timeout=10000)
                post_logout_state = current_url(page)
                logout_clicked = True
                log(f"URL after logout: {post_logout_state}")
                break
        except Exception:
            pass

    if not logout_found:
        log("Direct logout not found; checking profile/avatar menu buttons")
        MENU_CANDIDATES = [
            "[class*='avatar']",
            "[class*='user-menu']",
            "[class*='UserMenu']",
            "[data-test-id*='avatar']",
            "[data-test-id*='menu']",
            "button[class*='user']",
            "button[class*='profile']",
            "[aria-label*='menu' i]",
            "[aria-label*='account' i]",
        ]
        for cand in MENU_CANDIDATES:
            try:
                el = page.locator(cand).first
                bb = el.bounding_box()
                if bb and bb["y"] >= 0 and bb["y"] + bb["height"] <= page.viewport_size["height"]:
                    log(f"Profile/menu button found: '{cand}' at {bb}")
                    el.click()
                    page.wait_for_timeout(1500)
                    # Now look for logout in the opened menu
                    for lcand in LOGOUT_CANDIDATES:
                        try:
                            lel = page.locator(lcand).first
                            if lel.is_visible():
                                lel.click()
                                log(f"Clicked logout from menu: '{lcand}'")
                                wait_stable(page, timeout=10000)
                                post_logout_state = current_url(page)
                                logout_found   = True
                                logout_clicked = True
                                log(f"URL after logout: {post_logout_state}")
                                break
                        except Exception:
                            pass
                    if logout_clicked:
                        break
                    else:
                        # Close menu (Escape)
                        page.keyboard.press("Escape")
                        log("Menu opened but no logout found inside; closed")
                    break
            except Exception:
                pass

    if not logout_found:
        log("No logout control found in current viewport without scrolling")

    # ── Final screenshot if still on workflows list ───────────────────────────
    if "/workflow" in current_url(page) and "workflows-list.png" in str(workflows_list_shot):
        log("Still on workflows page; refreshing workflows-list.png")
        save_shot(page, "workflows-list.png")

    browser.close()

# ── Summary report ─────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("SUMMARY REPORT")
print("="*70)
print(f"Workflows extracted ({len(workflows_found)}):")
for w in workflows_found:
    print(f"  • {w['name']}  [{w.get('status','—')}]")
print(f"\nBrunella canvas – editor root visible : {brunella_editor_visible}")
print(f"Brunella canvas – nodes visible       : {brunella_nodes_visible}")
print(f"Canvas screenshot                     : {brunella_canvas_shot}")
print(f"Workflows-list screenshot             : {workflows_list_shot}")
print(f"Logout found                          : {logout_found}")
print(f"Logout clicked                        : {logout_clicked}")
print(f"Post-logout URL/state                 : {post_logout_state}")
print("\nFull action log:")
for entry in LOG:
    print(f"  {entry}")
