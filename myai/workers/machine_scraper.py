import asyncio
import json
import sys
from typing import List, Dict, Any
from playwright.async_api import async_playwright

async def scrape_machinery_park(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Scrapes industrial machines from MachineryPark.com
    """
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Search URL (example)
        search_url = f"https://www.machinerypark.com/search?q={query}"
        
        try:
            await page.goto(search_url, wait_until="networkidle", timeout=30000)
            
            # Simple selector-based extraction (MachineryPark specific)
            items = await page.query_selector_all(".list-item") # Hypothetical selector
            
            for item in items[:limit]:
                title_el = await item.query_selector(".title")
                price_el = await item.query_selector(".price")
                url_el = await item.query_selector("a")
                
                title = await title_el.inner_text() if title_el else "N/A"
                price_text = await price_el.inner_text() if price_el else "0"
                url = await url_el.get_attribute("href") if url_el else ""
                
                # Clean price
                price = 0
                try:
                    price = float(''.join(filter(str.isdigit, price_text)))
                except:
                    pass
                
                results.append({
                    "title": title,
                    "price": price,
                    "currency": "EUR",
                    "url": f"https://www.machinerypark.com{url}" if url.startswith("/") else url,
                    "source": "MachineryPark"
                })
        except Exception as e:
            print(f"Error scraping MachineryPark: {e}", file=sys.stderr)
        finally:
            await browser.close()
            
    return results

async def main():
    if len(sys.argv) < 2:
        print(json.dumps([]))
        return
        
    query = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    # In a real scenario, we would run multiple scrapers in parallel
    results = await scrape_machinery_park(query, limit)
    
    # Mock some data if real scraping fails during test/dev
    if not results:
        results = [
            {
                "title": f"Used {query} Machine X1",
                "price": 12500,
                "currency": "EUR",
                "url": "https://example.com/machine1",
                "source": "MockSource"
            },
            {
                "title": f"Industrial {query} Pro",
                "price": 8000,
                "currency": "EUR",
                "url": "https://example.com/machine2",
                "source": "MockSource"
            }
        ]
        
    print(json.dumps(results))

if __name__ == "__main__":
    asyncio.run(main())
