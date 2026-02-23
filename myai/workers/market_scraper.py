from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
import asyncio
from playwright.async_api import async_playwright
import sys

async def scrape_page_data(url: str, selectors: Dict[str, str], mock_html: Optional[str] = None) -> Dict[str, Any]:
    """
    Kinyeri a megadott adatokat egy weboldalról CSS selectorok alapján.
    Ha mock_html meg van adva, azt használja a hálózati hívás helyett.
    """
    html_content = ""
    
    if mock_html:
        html_content = mock_html
    else:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                html_content = await page.content()
            except Exception as e:
                print(f"Error scraping {url}: {e}", file=sys.stderr)
                return {}
            finally:
                await browser.close()

    soup = BeautifulSoup(html_content, 'html.parser')
    
    data = {}
    for key, selector in selectors.items():
        element = soup.select_one(selector)
        if element:
            data[key] = element.get_text(strip=True)
            
    return data

if __name__ == "__main__":
    # Egyszerű teszt parancssorból
    if len(sys.argv) > 1:
        import json
        url_arg = sys.argv[1]
        selectors_arg = json.loads(sys.argv[2])
        loop = asyncio.get_event_loop()
        res = loop.run_until_complete(scrape_page_data(url_arg, selectors_arg))
        print(json.dumps(res, indent=2))
