"""
BAS schemas – Pydantic modellek az EV Hunter és AI Research pipeline-hoz.
"""
from pydantic import BaseModel


class MarketTrend(BaseModel):
    """Piaci trend a kutatási pipeline-ból."""
    region: str
    news_summary: str
    impact_on_prices: str  # pl. "decreasing", "stable", "increasing"
    timestamp: str

class CarResult(BaseModel):
    """Egyetlen autó találat."""
    brand: str
    model: str
    price: int
    year: int
    mileage: int
    link: str
    score: int
