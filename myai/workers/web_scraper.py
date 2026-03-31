"""
Web Scraping Worker - General Purpose Playwright Scraper
Supports: Dynamic content, JavaScript rendering, pagination, structured data extraction
Uses: Market research, competitor analysis, data collection

Author: Brunella Agent System
Version: 1.0.0
"""

import asyncio
import logging
import json
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from pathlib import Path
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check Playwright availability
HAS_PLAYWRIGHT = False
try:
    from playwright.async_api import async_playwright, Page, Browser
    HAS_PLAYWRIGHT = True
    logger.info("[OK] Playwright available")
except ImportError:
    logger.warning("[WARN] Playwright not available (pip install playwright && playwright install)")


# ============================================================================
# Pydantic Models
# ============================================================================

class SelectorRule(BaseModel):
    """CSS/XPath selector rule for data extraction"""
    name: str = Field(..., description="Field name")
    selector: str = Field(..., description="CSS or XPath selector")
    attribute: Optional[str] = Field(None, description="Attribute to extract (href, src, etc.)")
    multiple: bool = Field(False, description="Extract all matches (list)")
    transform: Optional[str] = Field(None, description="Transformation: trim, lowercase, uppercase")


class ScraperRequest(BaseModel):
    """Web scraping request"""
    url: str = Field(..., description="Target URL")
    selectors: List[SelectorRule] = Field(default_factory=list, description="Data extraction rules")
    wait_for: Optional[str] = Field(None, description="CSS selector to wait for before scraping")
    wait_timeout: int = Field(10000, description="Wait timeout in milliseconds")
    javascript: bool = Field(True, description="Enable JavaScript rendering")
    screenshot: bool = Field(False, description="Take screenshot after load")
    screenshot_path: Optional[str] = Field(None, description="Screenshot save path")
    pagination: bool = Field(False, description="Handle pagination")
    pagination_selector: Optional[str] = Field(None, description="Next page button selector")
    max_pages: int = Field(5, description="Maximum pages to scrape")
    rate_limit: float = Field(1.0, description="Delay between requests (seconds)")
    user_agent: Optional[str] = Field(None, description="Custom user agent")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom HTTP headers")


class ScraperResponse(BaseModel):
    """Web scraping response"""
    success: bool = Field(..., description="Scraping success")
    url: str = Field("", description="Scraped URL")
    data: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted data")
    pages_scraped: int = Field(0, description="Number of pages scraped")
    screenshot_path: Optional[str] = Field(None, description="Screenshot file path")
    error: Optional[str] = Field(None, description="Error message if failed")
    duration_seconds: float = Field(0.0, description="Total scraping time")


# ============================================================================
# Scraping Engine
# ============================================================================

async def extract_data_from_page(page: Page, selectors: List[SelectorRule]) -> Dict[str, Any]:
    """
    Extract data from page using selectors
    """
    data = {}
    
    for rule in selectors:
        try:
            if rule.multiple:
                # Extract all matching elements
                elements = await page.query_selector_all(rule.selector)
                values = []
                
                for elem in elements:
                    if rule.attribute:
                        value = await elem.get_attribute(rule.attribute)
                    else:
                        value = await elem.inner_text()
                    
                    if value:
                        values.append(_transform_value(value, rule.transform))
                
                data[rule.name] = values
            else:
                # Extract first matching element
                elem = await page.query_selector(rule.selector)
                
                if elem:
                    if rule.attribute:
                        value = await elem.get_attribute(rule.attribute)
                    else:
                        value = await elem.inner_text()
                    
                    if value:
                        data[rule.name] = _transform_value(value, rule.transform)
                else:
                    data[rule.name] = None
        
        except Exception as e:
            logger.warning(f"Failed to extract '{rule.name}': {e}")
            data[rule.name] = None
    
    return data


def _transform_value(value: str, transform: Optional[str]) -> str:
    """Apply transformation to extracted value"""
    if not transform:
        return value.strip()
    
    if transform == "trim":
        return value.strip()
    elif transform == "lowercase":
        return value.strip().lower()
    elif transform == "uppercase":
        return value.strip().upper()
    else:
        return value.strip()


async def scrape_with_pagination(
    page: Page,
    request: ScraperRequest
) -> List[Dict[str, Any]]:
    """
    Scrape multiple pages with pagination support
    """
    all_data = []
    current_page = 1
    
    while current_page <= request.max_pages:
        logger.info(f"Scraping page {current_page}/{request.max_pages}")
        
        # Wait for content to load
        if request.wait_for:
            try:
                await page.wait_for_selector(request.wait_for, timeout=request.wait_timeout)
            except Exception as e:
                logger.warning(f"Wait timeout on page {current_page}: {e}")
        
        # Extract data
        page_data = await extract_data_from_page(page, request.selectors)
        all_data.append(page_data)
        
        # Check for next page
        if current_page < request.max_pages and request.pagination_selector:
            try:
                next_button = await page.query_selector(request.pagination_selector)
                
                if next_button:
                    # Click next page
                    await next_button.click()
                    await asyncio.sleep(request.rate_limit)  # Rate limiting
                    current_page += 1
                else:
                    logger.info("No more pages to scrape")
                    break
            except Exception as e:
                logger.warning(f"Failed to navigate to next page: {e}")
                break
        else:
            break
    
    return all_data


async def scrape_page(request: ScraperRequest) -> ScraperResponse:
    """
    Main scraping function using Playwright
    """
    import time
    start_time = time.time()
    
    if not HAS_PLAYWRIGHT:
        return ScraperResponse(
            success=False,
            error="Playwright not installed. Run: pip install playwright && playwright install",
            duration_seconds=time.time() - start_time
        )
    
    try:
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            
            # Create context with custom settings
            context_options = {}
            if request.user_agent:
                context_options["user_agent"] = request.user_agent
            
            context = await browser.new_context(**context_options)
            
            # Set custom headers
            if request.headers:
                await context.set_extra_http_headers(request.headers)
            
            # Create page
            page = await context.new_page()
            
            # Navigate to URL
            logger.info(f"Navigating to {request.url}")
            await page.goto(request.url, wait_until="networkidle" if request.javascript else "domcontentloaded")
            
            # Scrape data
            if request.pagination and request.pagination_selector:
                data = await scrape_with_pagination(page, request)
            else:
                # Wait for content
                if request.wait_for:
                    await page.wait_for_selector(request.wait_for, timeout=request.wait_timeout)
                
                # Extract data
                single_data = await extract_data_from_page(page, request.selectors)
                data = [single_data] if single_data else []
            
            # Take screenshot if requested
            screenshot_path = None
            if request.screenshot:
                if request.screenshot_path:
                    screenshot_path = request.screenshot_path
                else:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    screenshot_path = f"data/screenshots/scrape_{timestamp}.png"
                
                Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=screenshot_path, full_page=True)
                logger.info(f"Screenshot saved: {screenshot_path}")
            
            # Cleanup
            await browser.close()
            
            duration = time.time() - start_time
            pages_scraped = len(data)
            
            logger.info(f"[OK] Scraping completed: {pages_scraped} pages in {duration:.2f}s")
            
            return ScraperResponse(
                success=True,
                url=request.url,
                data=data,
                pages_scraped=pages_scraped,
                screenshot_path=screenshot_path,
                duration_seconds=duration
            )
    
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        return ScraperResponse(
            success=False,
            url=request.url,
            error=str(e),
            duration_seconds=time.time() - start_time
        )


# ============================================================================
# Synchronous Wrapper
# ============================================================================

def scrape(request: ScraperRequest) -> ScraperResponse:
    """
    Synchronous wrapper for scrape_page
    
    Example:
        request = ScraperRequest(
            url="https://example.com",
            selectors=[
                SelectorRule(name="title", selector="h1"),
                SelectorRule(name="price", selector=".price"),
            ],
            wait_for=".content"
        )
        response = scrape(request)
        print(response.data)
    """
    return asyncio.run(scrape_page(request))


# ============================================================================
# Predefined Scraping Templates
# ============================================================================

def scrape_product_listings(url: str, max_pages: int = 5) -> ScraperResponse:
    """
    Template: E-commerce product listings
    """
    request = ScraperRequest(
        url=url,
        selectors=[
            SelectorRule(name="titles", selector=".product-title, h2.title", multiple=True),
            SelectorRule(name="prices", selector=".price, .product-price", multiple=True),
            SelectorRule(name="images", selector=".product-image img", attribute="src", multiple=True),
            SelectorRule(name="links", selector=".product-link, a.product", attribute="href", multiple=True),
        ],
        wait_for=".product, .product-item",
        pagination=True,
        pagination_selector="a.next, button.next-page",
        max_pages=max_pages,
        rate_limit=2.0
    )
    return scrape(request)


def scrape_article_content(url: str) -> ScraperResponse:
    """
    Template: News article or blog post
    """
    request = ScraperRequest(
        url=url,
        selectors=[
            SelectorRule(name="title", selector="h1, .article-title"),
            SelectorRule(name="author", selector=".author, .byline"),
            SelectorRule(name="date", selector=".publish-date, time"),
            SelectorRule(name="content", selector=".article-body, .content, article"),
            SelectorRule(name="tags", selector=".tag, .category", multiple=True),
        ],
        wait_for="article, .article-body",
        screenshot=True
    )
    return scrape(request)


def scrape_contact_info(url: str) -> ScraperResponse:
    """
    Template: Company contact information
    """
    request = ScraperRequest(
        url=url,
        selectors=[
            SelectorRule(name="company_name", selector="h1, .company-name"),
            SelectorRule(name="phone", selector="a[href^='tel:'], .phone"),
            SelectorRule(name="email", selector="a[href^='mailto:'], .email"),
            SelectorRule(name="address", selector=".address, .location"),
            SelectorRule(name="social_links", selector="a[href*='facebook'], a[href*='linkedin']", attribute="href", multiple=True),
        ],
        wait_for="body"
    )
    return scrape(request)


# ============================================================================
# CLI Interface
# ============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python web_scraper.py <url> [selectors_json]")
        print("\nExample:")
        print('  python web_scraper.py "https://example.com" \'[{"name":"title","selector":"h1"}]\'')
        print("\nTemplates:")
        print("  python web_scraper.py https://shop.example.com --template product")
        print("  python web_scraper.py https://blog.example.com/post --template article")
        sys.exit(1)
    
    url = sys.argv[1]
    
    # Check for templates
    if "--template" in sys.argv:
        template_idx = sys.argv.index("--template")
        if template_idx + 1 < len(sys.argv):
            template = sys.argv[template_idx + 1]
            
            if template == "product":
                response = scrape_product_listings(url)
            elif template == "article":
                response = scrape_article_content(url)
            elif template == "contact":
                response = scrape_contact_info(url)
            else:
                print(f"Unknown template: {template}")
                sys.exit(1)
        else:
            print("Template name required after --template")
            sys.exit(1)
    else:
        # Custom selectors
        if len(sys.argv) > 2:
            selectors_json = sys.argv[2]
            selectors_data = json.loads(selectors_json)
            selectors = [SelectorRule(**s) for s in selectors_data]
        else:
            # Default: extract all h1, h2, p
            selectors = [
                SelectorRule(name="headings", selector="h1, h2", multiple=True),
                SelectorRule(name="paragraphs", selector="p", multiple=True),
            ]
        
        request = ScraperRequest(url=url, selectors=selectors)
        response = scrape(request)
    
    # Output results
    if response.success:
        print(f"\n[OK] Scraping Success")
        print(f"Pages scraped: {response.pages_scraped}")
        print(f"Duration: {response.duration_seconds:.2f}s")
        print(f"\nExtracted Data:")
        print(json.dumps(response.data, indent=2, ensure_ascii=False))
        
        if response.screenshot_path:
            print(f"\nScreenshot: {response.screenshot_path}")
    else:
        print(f"\n[ERROR] Scraping Failed: {response.error}")
        sys.exit(1)
