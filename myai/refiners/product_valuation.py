from typing import Dict, Any

async def evaluate_product_potential(product_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Kiszámítja a termék potenciál pontszámát és ajánlást ad.
    """
    try:
        # Ár és piaci átlag kinyerése
        price = float(product_data.get("price", 0))
        market_average = float(product_data.get("market_average", price))
        
        # Alapértelmezett értékek
        demand_score = float(product_data.get("demand_score", 0.5))
        rarity = product_data.get("rarity", "medium")

        # Potenciál score kalkuláció
        # 1. Alulárazottság (max 0.5 pont)
        if market_average > 0:
            price_diff_ratio = (market_average - price) / market_average
            price_score = max(0, min(0.5, price_diff_ratio))
        else:
            price_score = 0

        # 2. Kereslet (max 0.3 pont)
        demand_contribution = demand_score * 0.3

        # 3. Ritkaság (max 0.2 pont)
        rarity_contribution = 0.1
        if rarity == "high":
            rarity_contribution = 0.2
        elif rarity == "low":
            rarity_contribution = 0.0

        potential_score = price_score + demand_contribution + rarity_contribution

        # Ajánlás meghatározása
        recommendation = "WATCH"
        if potential_score > 0.7:
            recommendation = "BUY"
        elif potential_score < 0.2:
            recommendation = "IGNORE"
        
        return {
            "potential_score": round(potential_score, 2),
            "recommendation": recommendation,
            "analysis": {
                "price_score": round(price_score, 2),
                "demand_contribution": round(demand_contribution, 2),
                "rarity_contribution": round(rarity_contribution, 2)
            }
        }
    except Exception as e:
        return {
            "potential_score": 0.0,
            "recommendation": "ERROR",
            "error": str(e)
        }

if __name__ == "__main__":
    import json
    import asyncio
    import sys
    
    if len(sys.argv) > 1:
        data = json.loads(sys.argv[1])
        loop = asyncio.get_event_loop()
        res = loop.run_until_complete(evaluate_product_potential(data))
        print(json.dumps(res, indent=2))
