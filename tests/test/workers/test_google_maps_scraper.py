# test/workers/test_google_maps_scraper.py
import pytest
from myai.workers.google_maps_scraper import scrape_businesses

@pytest.mark.asyncio
async def test_scrape_businesses_returns_data():
    results = await scrape_businesses("fogorvos Budapest", limit=2)
    assert len(results) > 0
    assert "name" in results[0]
    assert "website" in results[0]
