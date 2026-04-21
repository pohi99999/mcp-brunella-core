import pytest
from myai.refiners.product_valuation import evaluate_product_potential

@pytest.mark.asyncio
async def test_evaluate_product_potential_high():
    # Price is 33% below average, high demand
    product_data = {"price": 100, "market_average": 150, "demand_score": 0.8, "rarity": "high"}
    valuation = await evaluate_product_potential(product_data)
    assert valuation["recommendation"] == "BUY"
    assert valuation["potential_score"] > 0.7

@pytest.mark.asyncio
async def test_evaluate_product_potential_low():
    # Price is 50% above average, low demand
    product_data = {"price": 150, "market_average": 100, "demand_score": 0.2, "rarity": "low"}
    valuation = await evaluate_product_potential(product_data)
    assert valuation["recommendation"] == "IGNORE"
    assert valuation["potential_score"] < 0.3

@pytest.mark.asyncio
async def test_evaluate_product_potential_watch():
    # Price is at average
    product_data = {"price": 100, "market_average": 100, "demand_score": 0.5, "rarity": "medium"}
    valuation = await evaluate_product_potential(product_data)
    assert valuation["recommendation"] == "WATCH"
