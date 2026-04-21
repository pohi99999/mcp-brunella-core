# myai/workers/google_maps_scraper.py
import asyncio

async def scrape_businesses(query: str, limit: int = 5):
    # Dummy mock implementáció a teszthez
    return [{"name": "Teszt Fogászat", "website": "http://tesztfogaszat.hu", "address": "Budapest"}]
