
from playwright.sync_api import Page, expect, sync_playwright

def test_dashboard_load(page: Page):
    """
    Smoke test to verify the dashboard loads without crashing.
    """
    # 1. Arrange: Go to the dashboard.
    page.goto("http://localhost:5173")

    # 2. Assert: Check for a key element that indicates successful load.
    # Based on file names, "Mission Control" or similar might be in the title or header.
    # Let's look for "Mission Control" text which is likely present.
    expect(page.get_by_text("Mission Control", exact=False).first).to_be_visible()

    # 3. Screenshot: Capture the dashboard.
    page.screenshot(path="/home/jules/verification/dashboard_smoke.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_dashboard_load(page)
            print("Dashboard loaded successfully.")
        except Exception as e:
            print(f"Dashboard failed to load: {e}")
            page.screenshot(path="/home/jules/verification/dashboard_fail.png")
        finally:
            browser.close()
