import pytest
from myai.workers.market_scraper import scrape_page_data

@pytest.mark.asyncio
async def test_scrape_page_data_success():
    mock_html = """
    <html>
        <body>
            <h1 class="title">Product A</h1>
            <span class="price">123.45</span>
            <div id="availability">In Stock</div>
        </body>
    </html>
    """
    selectors = {
        "title": ".title",
        "price": ".price",
        "availability": "#availability"
    }
    # Test with mock HTML to avoid network calls during unit test
    results = await scrape_page_data(url="http://mockurl.com", selectors=selectors, mock_html=mock_html)
    
    assert "title" in results
    assert results["title"] == "Product A"
    assert "price" in results
    assert results["price"] == "123.45"
    assert "availability" in results
    assert results["availability"] == "In Stock"

@pytest.mark.asyncio
async def test_scrape_page_data_missing_selector():
    mock_html = "<html><body></body></html>"
    selectors = {"title": ".non-existent"}
    results = await scrape_page_data(url="http://mockurl.com", selectors=selectors, mock_html=mock_html)
    assert "title" not in results
