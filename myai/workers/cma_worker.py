"""
🏠 CMA Worker – Comparable Market Analysis motor
Track: real_estate_sales_campaign_20260216 – Phase 2

Glass Box: Összehasonlítható ingatlan adatokból piaci ár-tartomány becslés.
- CMA (Comparative Market Analysis): hasonló ingatlanok gyűjtése + ársáv
- Input: PropertyQuery (helyszín, típus, alapterület)
- Output: CMAReport (becsült ár, sáv ±%, comparable lista)
- Mock/Live mód: mock = determinisztikus teszt adatok
- Gemini web scrape stub (éles üzemnél aktiválható)

Használat:
    python cma_worker.py --location "Budapest, II." --type apartment --area 85 --mock
    echo '{"location": "Budapest", "type": "apartment", "area_m2": 85, "mock": true}' | python cma_worker.py
"""
from __future__ import annotations

import argparse
import json
import math
import random
import re
import sys
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Konstansok
# ─────────────────────────────────────────────────────────────────────────────

# Átlagos EUR/m² árak főbb régiókban (2026 Q1 piaci referencia)
REGION_PRICES: dict[str, dict[str, float]] = {
    "budapest_ii":      {"apartment": 3400, "house": 2800, "office": 2200, "warehouse": 900},
    "budapest_v":       {"apartment": 3800, "house": 0,    "office": 2800, "warehouse": 0},
    "budapest_xiii":    {"apartment": 3100, "house": 2600, "office": 2000, "warehouse": 850},
    "budapest_xi":      {"apartment": 2900, "house": 2500, "office": 1900, "warehouse": 800},
    "budapest_xiv":     {"apartment": 2700, "house": 2300, "office": 1800, "warehouse": 780},
    "budapest_other":   {"apartment": 2400, "house": 2100, "office": 1600, "warehouse": 700},
    "gyor":             {"apartment": 1900, "house": 1600, "office": 1400, "warehouse": 650},
    "pecs":             {"apartment": 1600, "house": 1400, "office": 1100, "warehouse": 550},
    "debrecen":         {"apartment": 1800, "house": 1500, "office": 1200, "warehouse": 580},
    "miskolc":          {"apartment": 1200, "house": 1100, "office": 900,  "warehouse": 480},
    "zalaegerszeg":     {"apartment": 1500, "house": 1300, "office": 1000, "warehouse": 520},
    "kecskemet":        {"apartment": 1700, "house": 1450, "office": 1150, "warehouse": 560},
    "default":          {"apartment": 1800, "house": 1500, "office": 1200, "warehouse": 600},
}

CONFIDENCE_BAND_PCT = 0.12   # ±12% alapértelmezett sáv
MARGIN_FOR_QUICK_SALE = 0.08 # 8% árengedmény gyors eladáshoz

PropertyType = Literal["apartment", "house", "office", "warehouse", "land"]
ConditionType = Literal["new", "excellent", "good", "average", "needs_renovation"]
TrendType = Literal["rising", "stable", "declining"]

CONDITION_MULTIPLIER: dict[str, float] = {
    "new": 1.15,
    "excellent": 1.08,
    "good": 1.00,
    "average": 0.92,
    "needs_renovation": 0.78,
}

# ─────────────────────────────────────────────────────────────────────────────
# Modellek
# ─────────────────────────────────────────────────────────────────────────────

class PropertyQuery(BaseModel):
    """Piacelemzési kérés."""
    location: str = Field(..., description="Helyszín (pl. 'Budapest, II. kerület')")
    type: PropertyType = Field(default="apartment")
    area_m2: float = Field(gt=10, le=10000, description="Alapterület m²-ben")
    condition: ConditionType = Field(default="good")
    floor: Optional[int] = Field(default=None, ge=0, le=50)
    has_parking: bool = False
    has_garden: bool = False
    year_built: Optional[int] = Field(default=None, ge=1800, le=2026)
    mock: bool = Field(default=False)
    limit: int = Field(default=5, ge=1, le=20)

    @field_validator("location")
    @classmethod
    def normalize_location(cls, v: str) -> str:
        return v.strip()


class ComparableProperty(BaseModel):
    """Egy összehasonlítható ingatlan piaci tétel."""
    id: str
    location: str
    type: str
    area_m2: float
    price_eur: float
    price_per_m2: float
    condition: str
    listed_date: str
    source: str
    url: str
    distance_m: float = 0.0        # Távolság a keresett ingatlantól (m)
    days_on_market: int = 0
    similarity_score: float = 0.0  # 0.0–1.0


class PriceEstimate(BaseModel):
    """Becsült piaci ár."""
    value_eur: float
    price_per_m2_eur: float
    low_eur: float                  # Alsó sáv (gyors eladás)
    high_eur: float                 # Felső sáv (prémium)
    quick_sale_eur: float           # Gyors eladási ár (−8%)
    confidence: float               # 0.0–1.0
    method: str


class MarketTrend(BaseModel):
    """Helyi piac trendje."""
    location: str
    trend: TrendType
    avg_days_on_market: int
    price_change_6m_pct: float     # % változás 6 hónapban
    demand_level: Literal["high", "medium", "low"]
    notes: str


class CMAReport(BaseModel):
    """Teljes összehasonlító piacelemzés."""
    generated_at: str
    query: PropertyQuery
    estimate: PriceEstimate
    comparables: list[ComparableProperty]
    market_trend: MarketTrend
    recommendation: str
    investment_score: float        # 0–10 (magasabb = jobb befektetés)
    source_count: int


# ─────────────────────────────────────────────────────────────────────────────
# Helyszín normalizáló
# ─────────────────────────────────────────────────────────────────────────────

def normalize_region_key(location: str) -> str:
    """Helyszín → REGION_PRICES kulcs.

    Szóhatáros regex-et használunk a Roman számjegyek azonosítására,
    hogy elkerüljük a substring-ütközéseket:
    - "XVIII" tartalmaz "VIII", "VII", "VI", "II" mint substring
    - lookbehind/lookahead gondoskodik arról, hogy csak teljes szávakat matcheljünk
    """
    loc = location.lower()
    if "budapest" in loc:
        # Regex: teljes szóhatáros Roman numeral keresés, fontossági sorrendben
        _ROMAN_RE = re.compile(
            r"(?<!\w)(xiv|xiii|xii|xi|ix|viii|vii|vi|iv|iii|ii|v|x|i)(?!\w)",
            re.IGNORECASE,
        )
        m = _ROMAN_RE.search(loc)
        if m:
            k = m.group(1)
            key = f"budapest_{k}"
            if key in REGION_PRICES:
                return key
        return "budapest_other"
    for city in ["gyor", "győr", "pecs", "pécs", "debrecen", "miskolc", "zalaegerszeg", "kecskemet", "kecskemét"]:
        if city.replace("ő", "o").replace("é", "e").replace("á", "a") in loc.replace("ő", "o").replace("é", "e").replace("á", "a"):
            return city.replace("ő", "o").replace("é", "e").replace("á", "a")
    return "default"


def base_price_per_m2(region: str, prop_type: str) -> float:
    region_data = REGION_PRICES.get(region, REGION_PRICES["default"])
    return region_data.get(prop_type, region_data.get("apartment", 1800))


# ─────────────────────────────────────────────────────────────────────────────
# Mock comparable generátor
# ─────────────────────────────────────────────────────────────────────────────

def generate_mock_comparables(query: PropertyQuery, base_ppm2: float) -> list[ComparableProperty]:
    """Determinisztikus mock comparables generálás."""
    rng = random.Random(hash(query.location + query.type + str(query.area_m2)) % (2**32))

    comparables: list[ComparableProperty] = []
    conditions = ["excellent", "good", "good", "average", "excellent"]
    variances = [1.08, 0.97, 1.03, 0.89, 1.12]
    sizes = [
        query.area_m2 * 0.92,
        query.area_m2 * 1.15,
        query.area_m2 * 0.98,
        query.area_m2 * 1.08,
        query.area_m2 * 0.85,
    ]

    for i in range(min(query.limit, 5)):
        ppm2 = base_ppm2 * variances[i] * CONDITION_MULTIPLIER.get(conditions[i], 1.0)
        area = sizes[i]
        price = round(ppm2 * area / 1000) * 1000

        comparables.append(ComparableProperty(
            id=f"COMP-{i+1:03d}",
            location=query.location,
            type=query.type,
            area_m2=round(area, 1),
            price_eur=price,
            price_per_m2=round(ppm2, 0),
            condition=conditions[i],
            listed_date=str(date(2026, 1 + (i % 2), 10 + i * 3)),
            source="ingatlan.com (mock)",
            url=f"https://ingatlan.com/mock/{i+1:06d}",
            distance_m=rng.uniform(100, 800),
            days_on_market=rng.randint(7, 90),
            similarity_score=round(1.0 - abs(area - query.area_m2) / max(query.area_m2, 1) * 0.5, 2),
        ))

    return comparables


# ─────────────────────────────────────────────────────────────────────────────
# Ár becslés
# ─────────────────────────────────────────────────────────────────────────────

def estimate_price(query: PropertyQuery, comparables: list[ComparableProperty]) -> PriceEstimate:
    """Súlyozott átlag + kondíció + kiegészítők alapján ár-becslés."""
    if comparables:
        # Hasonlósági súlyokkal számolt átlag ár/m²
        total_weight = sum(c.similarity_score for c in comparables)
        if total_weight > 0:
            weighted_ppm2 = sum(c.price_per_m2 * c.similarity_score for c in comparables) / total_weight
        else:
            weighted_ppm2 = sum(c.price_per_m2 for c in comparables) / len(comparables)
        method = "weighted_comparable_average"
        confidence = min(0.5 + len(comparables) * 0.08, 0.92)
    else:
        region = normalize_region_key(query.location)
        weighted_ppm2 = base_price_per_m2(region, query.type)
        method = "region_benchmark"
        confidence = 0.60

    # Kondíció korrekció
    cond_mult = CONDITION_MULTIPLIER.get(query.condition, 1.0)
    adj_ppm2 = weighted_ppm2 * cond_mult

    # Parkoló / kert bónusz
    if query.has_parking:
        adj_ppm2 *= 1.04
    if query.has_garden and query.type in ("house", "apartment"):
        adj_ppm2 *= 1.06

    # Alapterület alapjú korrekció (kisebb = drágább m²-enkénti ár)
    if query.area_m2 < 50:
        adj_ppm2 *= 1.05
    elif query.area_m2 > 200:
        adj_ppm2 *= 0.96

    value = round(adj_ppm2 * query.area_m2 / 1000) * 1000
    low = round(value * (1 - CONFIDENCE_BAND_PCT) / 1000) * 1000
    high = round(value * (1 + CONFIDENCE_BAND_PCT) / 1000) * 1000
    quick = round(value * (1 - MARGIN_FOR_QUICK_SALE) / 1000) * 1000

    return PriceEstimate(
        value_eur=value,
        price_per_m2_eur=round(adj_ppm2, 0),
        low_eur=low,
        high_eur=high,
        quick_sale_eur=quick,
        confidence=round(confidence, 2),
        method=method,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Piaci trend becslés
# ─────────────────────────────────────────────────────────────────────────────

def estimate_market_trend(location: str) -> MarketTrend:
    """Helyszín alapú trend (statikus referencia 2026 Q1)."""
    loc = location.lower()
    if "budapest" in loc:
        if any(k in loc for k in ["ii", "xii", "xi", "i.", "v."]):
            return MarketTrend(location=location, trend="rising",
                               avg_days_on_market=28, price_change_6m_pct=4.2,
                               demand_level="high",
                               notes="Prémium kerületek – erős külföldi kereslet")
        return MarketTrend(location=location, trend="stable",
                           avg_days_on_market=42, price_change_6m_pct=1.8,
                           demand_level="medium",
                           notes="Külső kerületek stabilan tartják az árat")
    if "gyor" in loc or "győr" in loc:
        return MarketTrend(location=location, trend="rising",
                           avg_days_on_market=35, price_change_6m_pct=3.1,
                           demand_level="high",
                           notes="Audi gyár közelsége erős keresletet generál")
    return MarketTrend(location=location, trend="stable",
                       avg_days_on_market=55, price_change_6m_pct=0.8,
                       demand_level="low",
                       notes="Vidéki piac – stabilabb árak, lassabb forgás")


# ─────────────────────────────────────────────────────────────────────────────
# Befektetési score
# ─────────────────────────────────────────────────────────────────────────────

def calc_investment_score(estimate: PriceEstimate, trend: MarketTrend, query: PropertyQuery) -> float:
    """0–10 skálán befektetési vonzerő."""
    score = 5.0

    # Trend bónusz
    if trend.trend == "rising":
        score += 2.0
    elif trend.trend == "declining":
        score -= 2.0

    # Kereslet
    if trend.demand_level == "high":
        score += 1.5
    elif trend.demand_level == "low":
        score -= 1.0

    # Gyors eladási rugalmasság
    if trend.avg_days_on_market < 35:
        score += 1.0

    # Kondíció (új/kiváló = jobb)
    if query.condition in ("new", "excellent"):
        score += 0.5
    elif query.condition == "needs_renovation":
        score -= 1.0

    return round(min(max(score, 0.0), 10.0), 1)


# ─────────────────────────────────────────────────────────────────────────────
# Ajánlás generátor
# ─────────────────────────────────────────────────────────────────────────────

def generate_recommendation(estimate: PriceEstimate, trend: MarketTrend, inv_score: float) -> str:
    if inv_score >= 7.5:
        return (f"[STRONG BUY] ERŐS VÁSÁRLÁSI JAVASLAT – Dinamikusan növekvő piac, "
                f"becsült ár: {estimate.value_eur:,.0f} EUR "
                f"(±{CONFIDENCE_BAND_PCT*100:.0f}%, megbízhatóság: {estimate.confidence*100:.0f}%). "
                f"Gyors eladásnál: {estimate.quick_sale_eur:,.0f} EUR.")
    if inv_score >= 5.0:
        return (f"[MODERATE] MÉRSÉKELT JAVASLAT – Stabil piac, normál forgási sebesség. "
                f"Becsült ár: {estimate.value_eur:,.0f} EUR "
                f"(sáv: {estimate.low_eur:,.0f}–{estimate.high_eur:,.0f} EUR).")
    return (f"[CAUTION] ÓVATOS MEGKÖZELÍTÉS – Lassú piac, long-term tartás ajánlott. "
            f"Becsült ár: {estimate.value_eur:,.0f} EUR, "
            f"gyors eladásnál akár {estimate.quick_sale_eur:,.0f} EUR.")


# ─────────────────────────────────────────────────────────────────────────────
# Fő API függvény
# ─────────────────────────────────────────────────────────────────────────────

def run_cma(query: PropertyQuery) -> CMAReport:
    """Teljes CMA futtatás."""
    region = normalize_region_key(query.location)
    base_ppm2 = base_price_per_m2(region, query.type)

    if query.mock:
        comparables = generate_mock_comparables(query, base_ppm2)
    else:
        # Live stub – browser-use integrációra vár
        comparables = generate_mock_comparables(query, base_ppm2)

    estimate = estimate_price(query, comparables)
    trend = estimate_market_trend(query.location)
    inv_score = calc_investment_score(estimate, trend, query)
    recommendation = generate_recommendation(estimate, trend, inv_score)

    return CMAReport(
        generated_at=datetime.now().isoformat(),
        query=query,
        estimate=estimate,
        comparables=comparables,
        market_trend=trend,
        recommendation=recommendation,
        investment_score=inv_score,
        source_count=len(comparables),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Markdown kimenet
# ─────────────────────────────────────────────────────────────────────────────

def to_markdown(report: CMAReport) -> str:
    e = report.estimate
    t = report.market_trend
    lines = [
        f"# 🏠 CMA Riport – {report.query.location}",
        f"**Típus:** {report.query.type} | **Alapterület:** {report.query.area_m2} m² | **Állapot:** {report.query.condition}",
        f"**Generálva:** {report.generated_at[:19]}",
        "",
        "## 💰 Ár Becslés",
        f"| Mutató | Érték |",
        "| --- | --- |",
        f"| Becsült piaci ár | **{e.value_eur:,.0f} EUR** |",
        f"| Ár/m² | {e.price_per_m2_eur:,.0f} EUR/m² |",
        f"| Alsó sáv (−12%) | {e.low_eur:,.0f} EUR |",
        f"| Felső sáv (+12%) | {e.high_eur:,.0f} EUR |",
        f"| Gyors eladás (−8%) | {e.quick_sale_eur:,.0f} EUR |",
        f"| Megbízhatóság | {e.confidence*100:.0f}% |",
        "",
        "## 📊 Piaci Trend",
        f"- **Trend:** {t.trend} | **Kereslet:** {t.demand_level}",
        f"- **Átlagos piacon töltött idő:** {t.avg_days_on_market} nap",
        f"- **6 havi árnövekedés:** {t.price_change_6m_pct:+.1f}%",
        f"- **Megjegyzés:** {t.notes}",
        "",
        "## 🏘️ Összehasonlítható Ingatlanok",
    ]
    for c in report.comparables:
        lines.append(
            f"- `{c.id}` {c.area_m2} m² – {c.price_eur:,.0f} EUR ({c.price_per_m2:.0f} EUR/m²) "
            f"– {c.condition} – {c.days_on_market} nap piacon – hasonlóság: {c.similarity_score:.0%}"
        )
    lines += [
        "",
        "## 🎯 Ajánlás",
        report.recommendation,
        f"\n**Befektetési score:** {report.investment_score}/10",
    ]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CMA Worker – Comparable Market Analysis")
    parser.add_argument("--location", default="Budapest, XI.", help="Helyszín")
    parser.add_argument("--type", dest="prop_type", default="apartment",
                        choices=["apartment", "house", "office", "warehouse", "land"])
    parser.add_argument("--area", type=float, default=75.0, help="Alapterület m²")
    parser.add_argument("--condition", default="good",
                        choices=["new", "excellent", "good", "average", "needs_renovation"])
    parser.add_argument("--parking", action="store_true")
    parser.add_argument("--garden", action="store_true")
    parser.add_argument("--mock", action="store_true", help="Mock adatok")
    parser.add_argument("--markdown", action="store_true", help="Markdown kimenet")
    parser.add_argument("--limit", type=int, default=5, help="Comparable-k száma")
    args = parser.parse_args()

    # Stdin JSON override
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            data = json.loads(raw)
            query = PropertyQuery(
                location=data.get("location", args.location),
                type=data.get("type", args.prop_type),
                area_m2=data.get("area_m2", args.area),
                condition=data.get("condition", args.condition),
                has_parking=data.get("has_parking", args.parking),
                has_garden=data.get("has_garden", args.garden),
                mock=data.get("mock", args.mock),
                limit=data.get("limit", args.limit),
            )
        else:
            query = PropertyQuery(location=args.location, type=args.prop_type,
                                  area_m2=args.area, condition=args.condition,
                                  has_parking=args.parking, has_garden=args.garden,
                                  mock=args.mock, limit=args.limit)
    else:
        query = PropertyQuery(location=args.location, type=args.prop_type,
                              area_m2=args.area, condition=args.condition,
                              has_parking=args.parking, has_garden=args.garden,
                              mock=args.mock, limit=args.limit)

    report = run_cma(query)

    if args.markdown:
        print(to_markdown(report))
    else:
        print(json.dumps(report.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
