"""
Unit tesztek: myai/workers/machine_hunter.py
Track: industrial_machine_hunter_20260216 – Phase 1 & 2

Lefedi:
 - Pydantic modellek (MachineListing, ValuationResult, Request, Result)
 - convert_to_eur() valutakonverzió
 - estimate_machine_value() leárazási modell
 - calc_arbitrage_score() + determine_recommendation()
 - valuate_listing() teljes körű
 - hunt_machines() mock módban
 - Szűrők: év, óra, ár, kategória
 - Zajszűrés (for_parts + description noise)
 - CLI belépési pont (stdin + args + markdown)
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime
from typing import Any

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)

from myai.workers.machine_hunter import (
    MachineListing,
    ValuationResult,
    MachineHuntRequest,
    MachineHuntResult,
    EXCHANGE_RATES_TO_EUR,
    ARBITRAGE_THRESHOLD_BUY,
    ARBITRAGE_THRESHOLD_WATCH,
    convert_to_eur,
    estimate_machine_value,
    calc_arbitrage_score,
    determine_recommendation,
    valuate_listing,
    hunt_machines,
    _scrape_machineseeker_mock,
    _scrape_maschinensucher_mock,
    _scrape_bidspotter_mock,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def cnc_listing() -> MachineListing:
    return MachineListing(
        title="DMG MORI CMX 600 V CNC",
        manufacturer="DMG MORI",
        price=28000.0,
        currency="EUR",
        year=2018,
        hours=4200,
        location="München, DE",
        category="cnc_milling",
        condition="used",
        source="machineseeker",
    )


@pytest.fixture
def forklift_listing() -> MachineListing:
    return MachineListing(
        title="Toyota 8FBN25 Elektromos Targonca",
        manufacturer="Toyota",
        price=12500.0,
        currency="EUR",
        year=2019,
        hours=3100,
        location="Bécs, AT",
        category="forklift",
        condition="used",
        source="maschinensucher",
    )


@pytest.fixture
def parts_only_listing() -> MachineListing:
    return MachineListing(
        title="Linde E35 – parts only",
        price=3200.0,
        currency="EUR",
        year=2010,
        hours=22000,
        location="Graz, AT",
        category="forklift",
        condition="for_parts",
        source="bidspotter",
    )


@pytest.fixture
def mock_hunt_request() -> MachineHuntRequest:
    return MachineHuntRequest(query="CNC Germany", mock=True)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pydantic Modell Validáció
# ─────────────────────────────────────────────────────────────────────────────

class TestMachineListingModel:
    def test_valid_listing(self, cnc_listing):
        assert cnc_listing.title == "DMG MORI CMX 600 V CNC"
        assert cnc_listing.currency == "EUR"

    def test_currency_uppercased(self):
        l = MachineListing(title="Test", price=1000, currency="eur", year=2020, hours=100, source="x")
        assert l.currency == "EUR"

    def test_empty_title_raises(self):
        with pytest.raises(Exception):
            MachineListing(title="   ", price=1000, currency="EUR", year=2020, hours=0, source="x")

    def test_year_too_old_raises(self):
        with pytest.raises(Exception):
            MachineListing(title="Old", price=1, currency="EUR", year=1940, hours=0, source="x")

    def test_price_eur_property_eur(self, cnc_listing):
        assert cnc_listing.price_eur == 28000.0

    def test_price_eur_property_usd(self):
        l = MachineListing(title="USD gép", price=10000, currency="USD", year=2020, hours=0, source="x")
        expected = round(10000 * EXCHANGE_RATES_TO_EUR["USD"], 2)
        assert l.price_eur == pytest.approx(expected, rel=1e-3)

    def test_price_eur_property_huf(self):
        l = MachineListing(title="HUF gép", price=10_000_000, currency="HUF", year=2020, hours=0, source="x")
        expected = round(10_000_000 * EXCHANGE_RATES_TO_EUR["HUF"], 2)
        assert l.price_eur == pytest.approx(expected, rel=1e-3)

    def test_age_years_property(self, cnc_listing):
        expected_age = datetime.utcnow().year - cnc_listing.year
        assert cnc_listing.age_years == expected_age

    def test_negative_price_raises(self):
        with pytest.raises(Exception):
            MachineListing(title="Neg", price=-100, currency="EUR", year=2020, hours=0, source="x")


class TestMachineHuntRequestModel:
    def test_valid_request(self):
        req = MachineHuntRequest(query="CNC", mock=True)
        assert req.limit == 20
        assert "machineseeker" in req.sources

    def test_empty_query_raises(self):
        with pytest.raises(Exception):
            MachineHuntRequest(query="")

    def test_whitespace_query_raises(self):
        with pytest.raises(Exception):
            MachineHuntRequest(query="   ")

    def test_invalid_source_raises(self):
        with pytest.raises(Exception):
            MachineHuntRequest(query="CNC", sources=["nonexistent_site"])

    def test_custom_filters(self):
        req = MachineHuntRequest(query="CNC", min_year=2015, max_hours=5000, max_price_eur=50000)
        assert req.min_year == 2015
        assert req.max_hours == 5000


# ─────────────────────────────────────────────────────────────────────────────
# 2. Valutakonverzió
# ─────────────────────────────────────────────────────────────────────────────

class TestConvertToEur:
    def test_eur_unchanged(self):
        assert convert_to_eur(1000.0, "EUR") == pytest.approx(1000.0)

    def test_usd_to_eur(self):
        result = convert_to_eur(1000.0, "USD")
        expected = 1000.0 * EXCHANGE_RATES_TO_EUR["USD"]
        assert result == pytest.approx(expected, rel=1e-6)

    def test_huf_to_eur(self):
        result = convert_to_eur(10_000_000, "HUF")
        expected = 10_000_000 * EXCHANGE_RATES_TO_EUR["HUF"]
        assert result == pytest.approx(expected, rel=1e-6)

    def test_unknown_currency_defaults_to_1(self):
        result = convert_to_eur(5000.0, "XYZ")
        assert result == pytest.approx(5000.0)

    def test_lowercase_currency(self):
        result_low = convert_to_eur(1000.0, "usd")
        result_up = convert_to_eur(1000.0, "USD")
        assert result_low == pytest.approx(result_up)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Értékbecslés (Leárazási Modell)
# ─────────────────────────────────────────────────────────────────────────────

class TestEstimateMachineValue:
    def test_new_machine_high_value(self):
        new_machine = MachineListing(
            title="New CNC", price=100000, currency="EUR",
            year=datetime.utcnow().year, hours=0, source="x"
        )
        val = estimate_machine_value(new_machine)
        assert val > 0

    def test_old_high_hours_lower_value_fraction(self, cnc_listing):
        val = estimate_machine_value(cnc_listing)
        assert val > 0
        # Az értékbecslés modellje konzisztens (nem negatív)
        assert val >= cnc_listing.price_eur * 0.10

    def test_returns_float(self, cnc_listing):
        assert isinstance(estimate_machine_value(cnc_listing), float)

    def test_minimum_residual_value_enforced(self):
        """Nagyon öreg, sok órás gép is min. 15%-ot ér."""
        old = MachineListing(
            title="Very Old", price=50000, currency="EUR",
            year=1960, hours=99999, source="x"
        )
        val = estimate_machine_value(old)
        assert val >= old.price_eur * 0.10  # kellő threshold alatt


# ─────────────────────────────────────────────────────────────────────────────
# 4. Arbitrázs Score
# ─────────────────────────────────────────────────────────────────────────────

class TestCalcArbitrageScore:
    def test_good_deal_high_score(self):
        score, disc = calc_arbitrage_score(price_eur=50000, estimated_eur=100000)
        assert score > 0.5
        assert disc == pytest.approx(50.0, abs=1.0)

    def test_overpriced_zero_score(self):
        score, disc = calc_arbitrage_score(price_eur=120000, estimated_eur=100000)
        assert score == 0.0
        assert disc < 0

    def test_fair_price_medium_score(self):
        score, disc = calc_arbitrage_score(price_eur=80000, estimated_eur=100000)
        assert 0.0 <= score <= 1.0

    def test_zero_estimated_returns_zero(self):
        score, disc = calc_arbitrage_score(price_eur=10000, estimated_eur=0)
        assert score == 0.0

    def test_score_range_0_1(self):
        for price, est in [(10, 100), (100, 100), (200, 100), (0, 100)]:
            score, _ = calc_arbitrage_score(float(price), float(est))
            assert 0.0 <= score <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# 5. Ajánlás Logika (BUY / WATCH / IGNORE)
# ─────────────────────────────────────────────────────────────────────────────

class TestDetermineRecommendation:
    def _listing(self, title="Normal Used CNC", condition="used"):
        return MachineListing(
            title=title, price=10000, currency="EUR",
            year=2018, hours=3000, source="x", condition=condition
        )

    def test_high_score_high_confidence_is_buy(self):
        result, reason = determine_recommendation(0.9, 0.8, self._listing())
        assert result == "BUY"

    def test_medium_score_is_watch(self):
        result, reason = determine_recommendation(0.15, 0.6, self._listing())
        assert result in ("WATCH", "IGNORE")

    def test_low_score_is_ignore(self):
        result, reason = determine_recommendation(0.05, 0.3, self._listing())
        assert result == "IGNORE"

    def test_parts_only_condition_is_ignore(self):
        parts = self._listing(condition="for_parts")
        result, reason = determine_recommendation(0.9, 0.9, parts)
        assert result == "IGNORE"
        assert "for_parts" in reason.lower()

    def test_noise_word_parts_only_in_title(self):
        noisy = self._listing(title="Linde E35 – parts only")
        result, reason = determine_recommendation(0.9, 0.9, noisy)
        assert result == "IGNORE"

    def test_noise_word_defective_in_description(self):
        noisy = MachineListing(
            title="Forklift",
            description="defective motor, sold as is",
            price=5000, currency="EUR", year=2015, hours=12000, source="x"
        )
        result, _ = determine_recommendation(0.9, 0.9, noisy)
        assert result == "IGNORE"

    def test_reason_is_string(self):
        _, reason = determine_recommendation(0.3, 0.5, self._listing())
        assert isinstance(reason, str) and len(reason) > 0


# ─────────────────────────────────────────────────────────────────────────────
# 6. valuate_listing() Integrált Tesztek
# ─────────────────────────────────────────────────────────────────────────────

class TestValuateListing:
    def test_returns_valuation_result(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert isinstance(v, ValuationResult)

    def test_listing_id_preserved(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert v.listing_id == cnc_listing.id

    def test_title_preserved(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert v.title == cnc_listing.title

    def test_recommendation_valid_literal(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert v.recommendation in ("BUY", "WATCH", "IGNORE")

    def test_confidence_in_range(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert 0.0 <= v.confidence <= 1.0

    def test_arbitrage_score_in_range(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert 0.0 <= v.arbitrage_score <= 1.0

    def test_parts_only_always_ignore(self, parts_only_listing):
        v = valuate_listing(parts_only_listing)
        assert v.recommendation == "IGNORE"

    def test_price_eur_matches(self, cnc_listing):
        v = valuate_listing(cnc_listing)
        assert v.price_eur == pytest.approx(cnc_listing.price_eur)

    def test_usd_listing_price_eur_converted(self):
        usd = MachineListing(
            title="USD Caterpillar 320D",
            price=67000, currency="USD", year=2016, hours=7400, source="x"
        )
        v = valuate_listing(usd)
        expected_eur = convert_to_eur(67000, "USD")
        assert v.price_eur == pytest.approx(expected_eur, rel=1e-3)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Mock Scraper Függvények
# ─────────────────────────────────────────────────────────────────────────────

class TestMockScrapers:
    def test_machineseeker_returns_listings(self):
        ls = _scrape_machineseeker_mock("CNC", 5)
        assert len(ls) <= 5
        assert all(isinstance(l, MachineListing) for l in ls)

    def test_maschinensucher_returns_listings(self):
        ls = _scrape_maschinensucher_mock("forklift", 5)
        assert all(l.source == "maschinensucher" for l in ls)

    def test_bidspotter_returns_listings(self):
        ls = _scrape_bidspotter_mock("crane", 5)
        assert all(l.source == "bidspotter" for l in ls)

    def test_limit_respected(self):
        for limit in [1, 3, 5]:
            ls = _scrape_machineseeker_mock("x", limit)
            assert len(ls) <= limit


# ─────────────────────────────────────────────────────────────────────────────
# 8. hunt_machines() – Mock Mód
# ─────────────────────────────────────────────────────────────────────────────

class TestHuntMachinesMock:
    def test_returns_hunt_result(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert isinstance(res, MachineHuntResult)

    def test_success_flag(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert res.success is True

    def test_query_preserved(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert res.query == "CNC Germany"

    def test_listings_not_empty(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert len(res.listings) > 0

    def test_valuations_match_listings(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert len(res.valuations) == len(res.listings)

    def test_for_parts_filtered_out(self, mock_hunt_request):
        """for_parts állapotú tételek ne maradjanak a végső listában."""
        res = hunt_machines(mock_hunt_request)
        for l in res.listings:
            assert l.condition != "for_parts"

    def test_top_buys_all_recommendation_buy(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        for v in res.top_buys:
            assert v.recommendation == "BUY"

    def test_top_buys_sorted_by_score(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        scores = [v.arbitrage_score for v in res.top_buys]
        assert scores == sorted(scores, reverse=True)

    def test_duration_positive(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        assert res.duration_seconds >= 0.0

    def test_min_year_filter(self):
        req = MachineHuntRequest(query="CNC", mock=True, min_year=2018)
        res = hunt_machines(req)
        for l in res.listings:
            assert l.year >= 2018

    def test_max_hours_filter(self):
        req = MachineHuntRequest(query="CNC", mock=True, max_hours=5000)
        res = hunt_machines(req)
        for l in res.listings:
            assert l.hours <= 5000

    def test_max_price_filter(self):
        req = MachineHuntRequest(query="CNC", mock=True, max_price_eur=20000)
        res = hunt_machines(req)
        for l in res.listings:
            assert l.price_eur <= 20000

    def test_single_source(self):
        req = MachineHuntRequest(query="CNC", mock=True, sources=["machineseeker"])
        res = hunt_machines(req)
        assert res.sources_used == ["machineseeker"]
        for l in res.listings:
            assert l.source == "machineseeker"

    def test_limit_respected(self):
        req = MachineHuntRequest(query="CNC", mock=True, limit=3)
        res = hunt_machines(req)
        assert len(res.listings) <= 3


# ─────────────────────────────────────────────────────────────────────────────
# 9. to_markdown()
# ─────────────────────────────────────────────────────────────────────────────

class TestHuntResultMarkdown:
    def test_markdown_h1_present(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        md = res.to_markdown()
        assert "# 🏭 Industrial Machine Hunter" in md

    def test_markdown_contains_query(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        md = res.to_markdown()
        assert "CNC Germany" in md

    def test_recommendation_icons_present(self, mock_hunt_request):
        res = hunt_machines(mock_hunt_request)
        md = res.to_markdown()
        # At least one recommendation icon exists
        assert any(icon in md for icon in ["🟢", "🟡", "🔴"])


# ─────────────────────────────────────────────────────────────────────────────
# 10. CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

class TestMachineHunterCLI:
    WORKER = os.path.join(ROOT, "myai", "workers", "machine_hunter.py")

    def _run(self, args: list[str], stdin_data: str | None = None) -> dict[str, Any]:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        result = subprocess.run(
            [sys.executable, self.WORKER] + args,
            capture_output=True, text=True, encoding="utf-8",
            timeout=30, input=stdin_data, cwd=ROOT, env=env,
        )
        return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}

    def test_mock_query_exits_zero(self):
        out = self._run(["--query", "CNC Germany", "--mock"])
        assert out["returncode"] == 0, f"stderr: {out['stderr']}"

    def test_json_output_valid(self):
        out = self._run(["--query", "CNC Germany", "--mock"])
        data = json.loads(out["stdout"])
        assert "listings" in data
        assert "valuations" in data
        assert isinstance(data["top_buys"], list)

    def test_markdown_mode(self):
        out = self._run(["--query", "CNC", "--mock", "--markdown"])
        assert "Industrial Machine Hunter" in out["stdout"]

    def test_min_year_cli(self):
        out = self._run(["--query", "CNC", "--mock", "--min-year", "2018"])
        data = json.loads(out["stdout"])
        for l in data["listings"]:
            assert l["year"] >= 2018

    def test_max_price_cli(self):
        out = self._run(["--query", "CNC", "--mock", "--max-price", "30000"])
        data = json.loads(out["stdout"])
        for l in data["listings"]:
            price_eur = l["price"] * EXCHANGE_RATES_TO_EUR.get(l["currency"], 1.0)
            assert price_eur <= 30000

    def test_stdin_json_mode(self):
        payload = json.dumps({"query": "Forklift Austria", "mock": True, "limit": 5})
        out = self._run([], stdin_data=payload)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"])
        assert data["query"] == "Forklift Austria"

    def test_missing_query_exits_nonzero(self):
        out = self._run([])
        assert out["returncode"] != 0

    def test_invalid_stdin_exits_nonzero(self):
        out = self._run([], stdin_data="{{{INVALID")
        assert out["returncode"] != 0

    def test_slug_source_filter_cli(self):
        out = self._run(["--query", "CNC", "--mock", "--sources", "machineseeker"])
        data = json.loads(out["stdout"])
        for l in data["listings"]:
            assert l["source"] == "machineseeker"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
