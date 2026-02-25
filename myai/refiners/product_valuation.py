# myai/refiners/product_valuation.py
import json
import sys
from typing import Dict, Any, List

def evaluate_product(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates a single product item and gives it a potential score.
    Uses price vs market average, condition, and source reliability.
    """
    # Clean price
    price_str = str(item.get('price', '0'))
    price = 0
    try:
        price = float(''.join(filter(lambda x: x.isdigit() or x == '.', price_str.replace(',', '.'))))
    except:
        price = 0

    # Market Average Calculation (Improved)
    # In reality, this would query historical data in LanceDB
    # For now, we use a slightly more complex mock
    base_market_avg = price * 1.2
    
    # Adjust market average based on category if available
    category = item.get('category', 'general').lower()
    multipliers = {
        'electronics': 1.15,
        'machinery': 1.3,
        'real_estate': 1.1,
        'vehicle': 1.25
    }
    market_avg = base_market_avg * multipliers.get(category, 1.0)
    
    # Condition Factor
    condition_score = 1.0
    condition = str(item.get('condition', 'unknown')).lower()
    if 'new' in condition or 'újszerű' in condition:
        condition_score = 1.2
    elif 'used' in condition or 'használt' in condition:
        condition_score = 0.8
    elif 'broken' in condition or 'hibás' in condition:
        condition_score = 0.3

    # Potential Score Calculation
    price_diff_ratio = (market_avg - price) / market_avg if market_avg > 0 else 0
    
    # Base potential is derived from price difference
    potential_score = 0.5 + (price_diff_ratio * 0.5)
    
    # Apply condition weight
    potential_score *= condition_score
    
    # Clamp between 0 and 1
    potential_score = max(0.0, min(1.0, potential_score))
    
    recommendation = "WATCH"
    if potential_score > 0.8:
        recommendation = "STRONG_BUY"
    elif potential_score > 0.65:
        recommendation = "BUY"
    elif potential_score < 0.3:
        recommendation = "OVERPRICED"
            
    return {
        "price_numeric": price,
        "market_average": round(market_avg, 2),
        "potential_score": round(potential_score, 2),
        "recommendation": recommendation,
        "analysis_factors": {
            "price_advantage": round(price_diff_ratio * 100, 1),
            "condition_multiplier": condition_score
        }
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({}))
        return
        
    try:
        data = json.loads(sys.argv[1])
        if isinstance(data, list):
            results = [ {**item, **evaluate_product(item)} for item in data ]
        else:
            results = {**data, **evaluate_product(data)}
            
        print(json.dumps(results, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
