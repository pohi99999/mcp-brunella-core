"""
Tesztek: cma_worker.py
Track: real_estate_sales_campaign_20260216 – Phase 2

Lefedett területek:
  - normalize_region_key(): helyszín → kulcs mapping (javított rendezés xiii/ii konfliktus)
  - base_price_per_m2(): régió + típus ár referencia
  - generate_mock_comparables(): determinisztikus komparábilis generálás
  - estimate_price(): súlyozott ár-becslés (weighted_comparable_average / region_benchmark)
  - estimate_market_trend(): piac trend (MarketTrend model)
  - calc_investment_score(): befektetési score (0–10)
  - generate_recommendation(): ajánlás szöveg
  - run_cma(): teljes riport pipeline
  - to_markdown(): markdown rendering
  - CLI: --mock, --markdown, --location, --type, --area, --parking
  - Pydantic validáció: PropertyQuery, CMAReport
  - Edge cases: ismeretlen helyszín, kis/nagy terület, kondíció hatások

MEGJEGYZÉS: Az implementáció mezőnevei:
  - CMAReport.market_trend (nem .trend)
  - MarketTrend.price_change_6m_pct (nem avg_price_change_pct)
  - MarketTrend.notes (nem forecast_12m)
  - PriceEstimate.price_per_m2_eur
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "myai" / "workers"))

from cma_worker import (
    CMAReport,
    ComparableProperty,
    PriceEstimate,
    PropertyQuery,
    MarketTrend,
    CONDITION_MULTIPLIER,
    REGION_PRICES,
    base_price_per_m2,
    calc_investment_score,
    estimate_market_trend,
    estimate_price,
    generate_mock_comparables,
    generate_recommendation,
    normalize_region_key,
    run_cma,
    to_markdown,
)

WORKER_PATH = str(Path(__file__).parent.parent / "workers" / "cma_worker.py")
PYTHON = sys.executable


# ─────────────────────────────────────────────────────────────────────────────
# normalize_region_key()
# ─────────────────────────────────────────────────────────────────────────────

class TestNormalizeRegionKey:
    def test_budapest_ii(self):
        # "ii" nem illeszkedik "xiii"-ra a javított rendezés után
        assert normalize_region_key("Budapest, II. kerület") == "budapest_ii"

    def test_budapest_v(self):
        assert normalize_region_key("Budapest V.") == "budapest_v"

    def test_budapest_xi(self):
        assert normalize_region_key("Budapest XI") == "budapest_xi"

    def test_budapest_xiii(self):
        # Kulcsteszt: "xiii" tartalmazza "ii"-t, de a javított fn jól kezeli
        assert normalize_region_key("Budapest, XIII. kerület") == "budapest_xiii"

    def test_budapest_xiv(self):
        assert normalize_region_key("Budapest, XIV. kerület") == "budapest_xiv"

    def test_budapest_other(self):
        # XVIII. kerület nem szerepel a listában → budapest_other
        result = normalize_region_key("Budapest, XVIII. kerület")
        assert result == "budapest_other"

    def test_gyor(self):
        key = normalize_region_key("Győr, Belváros")
        assert "gyor" in key

    def test_debrecen(self):
        key = normalize_region_key("Debrecen")
        assert "debrecen" in key

    def test_zalaegerszeg(self):
        key = normalize_region_key("Zalaegerszeg, Belváros")
        assert "zalaegerszeg" in key

    def test_unknown_falls_to_default(self):
        key = normalize_region_key("Hajdúböszörmény")
        assert key == "default"


# ─────────────────────────────────────────────────────────────────────────────
# base_price_per_m2()
# ─────────────────────────────────────────────────────────────────────────────

class TestBasePricePerM2:
    def test_budapest_ii_apartment(self):
        price = base_price_per_m2("budapest_ii", "apartment")
        assert price == REGION_PRICES["budapest_ii"]["apartment"]
        assert price > 3000  # prémium kerület

    def test_miskolc_apartment_is_cheaper_than_budapest(self):
        bp = base_price_per_m2("budapest_ii", "apartment")
        mk = base_price_per_m2("miskolc", "apartment")
        assert bp > mk

    def test_warehouse_cheaper_than_apartment_in_same_region(self):
        apt = base_price_per_m2("budapest_ii", "apartment")
        wh = base_price_per_m2("budapest_ii", "warehouse")
        assert apt > wh

    def test_unknown_region_uses_default(self):
        price = base_price_per_m2("ismeretlen_varos", "apartment")
        assert price == REGION_PRICES["default"]["apartment"]


# ─────────────────────────────────────────────────────────────────────────────
# generate_mock_comparables()
# ─────────────────────────────────────────────────────────────────────────────

class TestGenerateMockComparables:
    def _query(self, **kwargs):
        d = {"location": "Budapest, XI.", "type": "apartment", "area_m2": 70.0, "mock": True}
        d.update(kwargs)
        return PropertyQuery(**d)

    def test_returns_list_of_comparable(self):
        q = self._query()
        comps = generate_mock_comparables(q, 2900)
        assert isinstance(comps, list)
        assert all(isinstance(c, ComparableProperty) for c in comps)

    def test_count_respects_limit(self):
        q = self._query(limit=3)
        comps = generate_mock_comparables(q, 2900)
        assert len(comps) <= 3

    def test_default_limit_5(self):
        q = self._query(limit=5)
        comps = generate_mock_comparables(q, 2900)
        assert len(comps) == 5

    def test_similarity_score_range(self):
        q = self._query()
        comps = generate_mock_comparables(q, 2900)
        for c in comps:
            assert 0.0 <= c.similarity_score <= 1.0

    def test_price_per_m2_positive(self):
        q = self._query()
        comps = generate_mock_comparables(q, 2900)
        for c in comps:
            assert c.price_per_m2 > 0
            assert c.price_eur > 0

    def test_deterministic_within_same_process(self):
        # random.Random seed → ugyanabban a folyamatban determinisztikus
        q = self._query(location="Debrecen", area_m2=90.0)
        c1 = generate_mock_comparables(q, 1800)
        c2 = generate_mock_comparables(q, 1800)
        assert [c.price_eur for c in c1] == [c.price_eur for c in c2]

    def test_different_base_prices_different_results(self):
        # Magasabb benchmark → magasabb átlag ár/m²
        q = self._query(location="Budapest, XI.", area_m2=75.0)
        c_low = generate_mock_comparables(q, 1000)
        c_high = generate_mock_comparables(q, 4000)
        avg_low = sum(c.price_per_m2 for c in c_low) / len(c_low)
        avg_high = sum(c.price_per_m2 for c in c_high) / len(c_high)
        assert avg_high > avg_low


# ─────────────────────────────────────────────────────────────────────────────
# estimate_price()
# ─────────────────────────────────────────────────────────────────────────────

class TestEstimatePrice:
    def _q(self, **kwargs):
        d = {"location": "Budapest, XI.", "type": "apartment", "area_m2": 75.0, "mock": True}
        d.update(kwargs)
        return PropertyQuery(**d)

    def _make_est(self, **kwargs):
        q = self._q(**kwargs)
        comps = generate_mock_comparables(q, 2900)
        return estimate_price(q, comps)

    def test_returns_price_estimate(self):
        est = self._make_est()
        assert isinstance(est, PriceEstimate)

    def test_value_positive(self):
        assert self._make_est().value_eur > 0

    def test_low_below_value(self):
        est = self._make_est()
        assert est.low_eur < est.value_eur

    def test_high_above_value(self):
        est = self._make_est()
        assert est.high_eur > est.value_eur

    def test_quick_sale_below_value(self):
        est = self._make_est()
        assert est.quick_sale_eur < est.value_eur

    def test_confidence_range(self):
        est = self._make_est()
        assert 0.0 <= est.confidence <= 1.0

    def test_new_condition_higher_than_renovation(self):
        est_new = self._make_est(condition="new")
        est_old = self._make_est(condition="needs_renovation")
        assert est_new.value_eur > est_old.value_eur

    def test_parking_increases_price(self):
        est_no = self._make_est(has_parking=False)
        est_yes = self._make_est(has_parking=True)
        assert est_yes.value_eur >= est_no.value_eur

    def test_empty_comparables_uses_benchmark(self):
        q = self._q()
        est = estimate_price(q, [])
        assert est.value_eur > 0
        assert est.method == "region_benchmark"

    def test_with_comps_uses_weighted_method(self):
        q = self._q()
        comps = generate_mock_comparables(q, 2900)
        est = estimate_price(q, comps)
        assert est.method == "weighted_comparable_average"


# ─────────────────────────────────────────────────────────────────────────────
# estimate_market_trend()
# ─────────────────────────────────────────────────────────────────────────────

class TestEstimateMarketTrend:
    def test_budapest_premium_rising(self):
        trend = estimate_market_trend("Budapest, II. kerület")
        assert trend.trend == "rising"
        assert trend.demand_level == "high"

    def test_videki_varos_stable(self):
        # Vidéki városok: stable + low demand (fallback ág)
        trend = estimate_market_trend("Salgótarján")
        assert trend.trend == "stable"

    def test_gyor_rising(self):
        trend = estimate_market_trend("Győr")
        assert trend.trend == "rising"

    def test_returns_market_trend_model(self):
        trend = estimate_market_trend("Budapest, XI.")
        assert isinstance(trend, MarketTrend)

    def test_avg_days_on_market_positive(self):
        trend = estimate_market_trend("Budapest, XI.")
        assert trend.avg_days_on_market > 0

    def test_notes_not_empty(self):
        trend = estimate_market_trend("Budapest, XI.")
        assert len(trend.notes) > 5


# ─────────────────────────────────────────────────────────────────────────────
# calc_investment_score()
# ─────────────────────────────────────────────────────────────────────────────

class TestInvestmentScore:
    def _run(self, location: str, condition: str = "good") -> float:
        q = PropertyQuery(location=location, type="apartment", area_m2=75.0,
                          condition=condition, mock=True)
        comps = generate_mock_comparables(q, 2500)
        est = estimate_price(q, comps)
        trend = estimate_market_trend(location)
        return calc_investment_score(est, trend, q)

    def test_score_range(self):
        score = self._run("Budapest, II.")
        assert 0.0 <= score <= 10.0

    def test_rising_market_outscores_stable(self):
        score_bp = self._run("Budapest, II.")   # rising
        score_mk = self._run("Miskolc")          # stable
        assert score_bp >= score_mk

    def test_new_condition_outscores_renovation(self):
        score_new = self._run("Budapest, XI.", condition="new")
        score_ren = self._run("Budapest, XI.", condition="needs_renovation")
        assert score_new > score_ren


# ─────────────────────────────────────────────────────────────────────────────
# run_cma()
# ─────────────────────────────────────────────────────────────────────────────

class TestRunCMA:
    def test_returns_cma_report(self):
        q = PropertyQuery(location="Budapest, XI.", type="apartment",
                          area_m2=75.0, mock=True)
        assert isinstance(run_cma(q), CMAReport)

    def test_report_has_comparables(self):
        q = PropertyQuery(location="Budapest, XI.", type="apartment",
                          area_m2=75.0, mock=True, limit=5)
        assert len(run_cma(q).comparables) == 5

    def test_recommendation_not_empty(self):
        q = PropertyQuery(location="Budapest, II.", type="apartment",
                          area_m2=85.0, mock=True)
        assert len(run_cma(q).recommendation) > 20

    def test_investment_score_in_range(self):
        q = PropertyQuery(location="Zalaegerszeg", type="house",
                          area_m2=120.0, mock=True)
        report = run_cma(q)
        assert 0.0 <= report.investment_score <= 10.0

    def test_office_type(self):
        q = PropertyQuery(location="Budapest, V.", type="office",
                          area_m2=200.0, mock=True)
        assert run_cma(q).estimate.value_eur > 0

    def test_warehouse_type(self):
        q = PropertyQuery(location="Győr", type="warehouse",
                          area_m2=500.0, mock=True)
        assert run_cma(q).estimate.value_eur > 0

    def test_market_trend_field_exists(self):
        # CMAReport.market_trend (nem .trend!)
        q = PropertyQuery(location="Budapest, XI.", type="apartment",
                          area_m2=75.0, mock=True)
        report = run_cma(q)
        assert hasattr(report, "market_trend")
        assert isinstance(report.market_trend, MarketTrend)


# ─────────────────────────────────────────────────────────────────────────────
# to_markdown()
# ─────────────────────────────────────────────────────────────────────────────

class TestToMarkdown:
    def _report(self):
        q = PropertyQuery(location="Budapest, XI.", type="apartment",
                          area_m2=75.0, mock=True)
        return run_cma(q)

    def test_contains_header(self):
        assert "CMA Riport" in to_markdown(self._report())

    def test_contains_eur(self):
        assert "EUR" in to_markdown(self._report())

    def test_contains_recommendation(self):
        assert "Ajánlás" in to_markdown(self._report())

    def test_contains_comparables_ids(self):
        assert "COMP-" in to_markdown(self._report())


# ─────────────────────────────────────────────────────────────────────────────
# CLI tesztek
# ─────────────────────────────────────────────────────────────────────────────

class TestCLI:
    def test_mock_json_output(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--location", "Budapest, XI.",
             "--area", "75", "--type", "apartment"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "estimate" in data
        assert "comparables" in data

    def test_mock_markdown_output(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--markdown",
             "--location", "Debrecen", "--area", "90"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        assert "CMA Riport" in result.stdout

    def test_office_type_cli(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--type", "office",
             "--location", "Budapest, V.", "--area", "200"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["query"]["type"] == "office"

    def test_parking_flag_in_json(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--parking",
             "--location", "Budapest, XI.", "--area", "80"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert data["query"]["has_parking"] is True

    def test_limit_controls_comparables_count(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--location", "Debrecen",
             "--area", "85", "--limit", "3"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert len(data["comparables"]) == 3
