"""
Tesztek: supply_matcher.py
Track: hyper_local_supply_chain_20260216 – Phase 2

Lefedett területek:
  - score_pallets(): pallet coverage scoring
  - score_vehicle(): vehicle type compatibility matrix
  - score_date(): date urgency scoring
  - score_match(): combined scoring
  - decide(): BOOK/CONSIDER/SKIP threshold
  - build_reason(): human-readable reason string
  - match_all(): full matching report
  - to_markdown(): report rendering
  - CLI: --mock, --mock --markdown, --book-only, --min-score flags
  - Edge cases: empty capacities/needs, missing fields, exact boundary values
"""
import json
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

# Repo root a sys.path-ba (hogy importálható legyen a workers csomag)
REPO_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "myai" / "workers"))

from supply_matcher import (
    FreightCapacity,
    InternalNeed,
    MatchReport,
    MatchResult,
    MatchScore,
    BOOK_THRESHOLD,
    CONSIDER_THRESHOLD,
    MOCK_CAPACITIES,
    MOCK_NEEDS_JSON,
    build_reason,
    decide,
    match_all,
    score_date,
    score_match,
    score_pallets,
    score_vehicle,
    to_markdown,
)

TODAY = date.today()
TOMORROW = TODAY + timedelta(days=1)
NEXT_WEEK = TODAY + timedelta(days=7)
NEXT_MONTH = TODAY + timedelta(days=30)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_need(**kwargs) -> InternalNeed:
    defaults = {
        "id": "IN-TEST",
        "priority": "HIGH",
        "type": "outbound_freight",
        "description": "Test need",
        "origin": "Zalaegerszeg, HU",
        "destination": "Graz, AT",
        "required_pallets": 8,
        "vehicle_type": "tautliner",
        "latest_date": str(NEXT_WEEK),
        "weight_kg": 1000.0,
        "value_eur": 10000.0,
        "contact": "test@brunella.ai",
    }
    defaults.update(kwargs)
    return InternalNeed(**defaults)


def make_cap(**kwargs) -> FreightCapacity:
    defaults = {
        "id": "CAP-TEST",
        "origin": "Zalaegerszeg, HU",
        "destination": "Graz, AT",
        "vehicle_type": "tautliner",
        "available_pallets": 10,
        "available_date": str(TOMORROW),
        "source": "timocom",
        "distance_km": 15.0,
        "contact": "Trans Kft.",
    }
    defaults.update(kwargs)
    return FreightCapacity(**defaults)


# ─────────────────────────────────────────────────────────────────────────────
# score_pallets()
# ─────────────────────────────────────────────────────────────────────────────

class TestScorePallets:
    def test_exact_match(self):
        assert score_pallets(8, 8) == 1.0

    def test_surplus_capacity(self):
        assert score_pallets(15, 8) == 1.0

    def test_80_percent_coverage(self):
        # 8 available / 10 required = 0.8 → 0.70
        s = score_pallets(8, 10)
        assert s == 0.70

    def test_60_percent_coverage(self):
        # 6 / 10 = 0.6 → 0.45
        s = score_pallets(6, 10)
        assert s == 0.45

    def test_very_low_coverage(self):
        # 2 / 10 = 0.2 → 0.20
        s = score_pallets(2, 10)
        assert s == 0.20

    def test_zero_available(self):
        s = score_pallets(0, 8)
        assert s == 0.20

    def test_output_range(self):
        for avail in range(0, 35):
            for req in range(1, 35):
                s = score_pallets(avail, req)
                assert 0.0 <= s <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# score_vehicle()
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreVehicle:
    def test_exact_tautliner(self):
        assert score_vehicle("tautliner", "tautliner") == 1.0

    def test_exact_mega(self):
        assert score_vehicle("mega", "mega") == 1.0

    def test_exact_flatbed(self):
        assert score_vehicle("flatbed", "flatbed") == 1.0

    def test_tautliner_vs_curtainsider(self):
        s = score_vehicle("tautliner", "curtainsider")
        assert s == 0.85

    def test_mega_vs_tautliner(self):
        s = score_vehicle("mega", "tautliner")
        assert s == 0.80

    def test_flatbed_vs_refrigerated(self):
        # Incompatible
        s = score_vehicle("flatbed", "refrigerated")
        assert s == 0.0

    def test_unknown_type_fallback(self):
        s = score_vehicle("unknown_truck", "tautliner")
        assert s == 0.10   # fallback default

    def test_case_insensitive(self):
        # FreightCapacity validator lowercases
        cap = make_cap(vehicle_type="Tautliner")
        need = make_need(vehicle_type="TAUTLINER")
        s = score_vehicle(cap.vehicle_type, need.vehicle_type)
        assert s == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# score_date()
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreDate:
    def test_available_day_before_deadline(self):
        dl = TODAY + timedelta(days=5)
        avail = TODAY + timedelta(days=2)
        assert score_date(avail, dl) == 1.0   # 3 nap előtte

    def test_available_one_week_before(self):
        dl = TODAY + timedelta(days=10)
        avail = TODAY + timedelta(days=3)
        s = score_date(avail, dl)
        assert s == 0.80   # 7 napon belül

    def test_available_two_weeks_before(self):
        dl = TODAY + timedelta(days=20)
        avail = TODAY + timedelta(days=6)
        s = score_date(avail, dl)
        assert s == 0.55

    def test_available_far_before(self):
        dl = TODAY + timedelta(days=60)
        avail = TODAY + timedelta(days=5)
        s = score_date(avail, dl)
        assert s == 0.30

    def test_available_on_deadline(self):
        dl = TODAY + timedelta(days=5)
        avail = dl
        s = score_date(avail, dl)
        assert s == 1.0  # diff=0 → ≤3

    def test_one_day_late(self):
        dl = TODAY + timedelta(days=3)
        avail = dl + timedelta(days=1)
        s = score_date(avail, dl)
        assert s == 0.25

    def test_very_late(self):
        dl = TODAY + timedelta(days=3)
        avail = dl + timedelta(days=5)
        s = score_date(avail, dl)
        assert s == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# score_match() + decide()
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreMatch:
    def test_perfect_match_is_book(self):
        cap = make_cap(
            available_pallets=10, vehicle_type="tautliner",
            available_date=str(TODAY + timedelta(days=3)),
        )
        need = make_need(
            required_pallets=8, vehicle_type="tautliner",
            latest_date=str(TODAY + timedelta(days=6)),
            priority="HIGH",
        )
        score = score_match(cap, need)
        assert score.total >= BOOK_THRESHOLD
        assert decide(score.total) == "BOOK"

    def test_wrong_vehicle_reduces_score(self):
        cap = make_cap(vehicle_type="refrigerated")
        need = make_need(vehicle_type="tautliner")
        score = score_match(cap, need)
        # refrigerated ↔ tautliner = 0.0 vehicle score → total low
        assert score.vehicle_score == 0.0
        assert score.total < BOOK_THRESHOLD

    def test_late_capacity_is_skip(self):
        cap = make_cap(available_date=str(TODAY + timedelta(days=20)))
        need = make_need(latest_date=str(TODAY + timedelta(days=2)))
        score = score_match(cap, need)
        # date_score = 0.0
        assert score.date_score == 0.0
        assert decide(score.total) in ("CONSIDER", "SKIP")

    def test_low_priority_reduces_weight(self):
        cap = make_cap(available_pallets=10, vehicle_type="tautliner",
                       available_date=str(TODAY + timedelta(days=2)))
        need_high = make_need(priority="HIGH", latest_date=str(TODAY + timedelta(days=5)))
        need_low = make_need(priority="LOW", latest_date=str(TODAY + timedelta(days=5)))
        score_high = score_match(cap, need_high)
        score_low = score_match(cap, need_low)
        assert score_high.total >= score_low.total

    def test_score_range_always_valid(self):
        for cap in MOCK_CAPACITIES:
            for raw in MOCK_NEEDS_JSON["internal_needs"]:
                need = InternalNeed(**raw)
                s = score_match(cap, need)
                assert 0.0 <= s.total <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# decide()
# ─────────────────────────────────────────────────────────────────────────────

class TestDecide:
    def test_book_threshold(self):
        assert decide(BOOK_THRESHOLD) == "BOOK"
        assert decide(1.0) == "BOOK"

    def test_consider_threshold(self):
        assert decide(CONSIDER_THRESHOLD) == "CONSIDER"
        assert decide(0.55) == "CONSIDER"

    def test_skip_below_threshold(self):
        assert decide(0.0) == "SKIP"
        assert decide(0.39) == "SKIP"


# ─────────────────────────────────────────────────────────────────────────────
# build_reason()
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildReason:
    def test_contains_pallet_info(self):
        cap = make_cap(available_pallets=10)
        need = make_need(required_pallets=8)
        score = score_match(cap, need)
        reason = build_reason(score, cap, need)
        assert "10/8" in reason or "10" in reason

    def test_contains_vehicle_info(self):
        cap = make_cap(vehicle_type="mega")
        need = make_need(vehicle_type="tautliner")
        score = score_match(cap, need)
        reason = build_reason(score, cap, need)
        assert "mega" in reason.lower()

    def test_contains_date_info(self):
        cap = make_cap(available_date=str(TODAY + timedelta(days=2)))
        need = make_need(latest_date=str(TODAY + timedelta(days=5)))
        score = score_match(cap, need)
        reason = build_reason(score, cap, need)
        assert "Dátum" in reason

    def test_reason_is_string(self):
        cap = make_cap()
        need = make_need()
        score = score_match(cap, need)
        reason = build_reason(score, cap, need)
        assert isinstance(reason, str) and len(reason) > 0


# ─────────────────────────────────────────────────────────────────────────────
# match_all()
# ─────────────────────────────────────────────────────────────────────────────

class TestMatchAll:
    def test_returns_match_report(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        assert isinstance(report, MatchReport)

    def test_total_needs_count(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        assert report.total_needs == len(needs)

    def test_total_capacities_count(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        assert report.total_capacities == len(MOCK_CAPACITIES)

    def test_matches_sorted_descending(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        scores = [r.score.total for r in report.matches]
        assert scores == sorted(scores, reverse=True)

    def test_count_consistency(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        assert report.book_count + report.consider_count + report.skip_count == len(report.matches)

    def test_empty_capacities(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all([], needs)
        assert report.total_capacities == 0
        assert len(report.matches) == 0
        assert report.best_match is None

    def test_empty_needs(self):
        report = match_all(MOCK_CAPACITIES, [])
        assert report.total_needs == 0
        assert len(report.matches) == 0

    def test_best_match_is_highest_score(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        report = match_all(MOCK_CAPACITIES, needs)
        if report.best_match:
            max_score = max(r.score.total for r in report.matches)
            assert report.best_match.score.total == max_score


# ─────────────────────────────────────────────────────────────────────────────
# to_markdown()
# ─────────────────────────────────────────────────────────────────────────────

class TestToMarkdown:
    def _get_report(self):
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
        return match_all(MOCK_CAPACITIES, needs)

    def test_markdown_contains_header(self):
        md = to_markdown(self._get_report())
        assert "Match Report" in md

    def test_markdown_contains_counts(self):
        report = self._get_report()
        md = to_markdown(report)
        assert "BOOK" in md or "CONSIDER" in md

    def test_markdown_is_string(self):
        md = to_markdown(self._get_report())
        assert isinstance(md, str) and len(md) > 100


# ─────────────────────────────────────────────────────────────────────────────
# CLI tesztek
# ─────────────────────────────────────────────────────────────────────────────

WORKER_PATH = str(
    Path(__file__).parent.parent / "workers" / "supply_matcher.py"
)
PYTHON = sys.executable


class TestCLI:
    def test_mock_json_output(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        assert "matches" in data
        assert "book_count" in data

    def test_mock_markdown_output(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--markdown"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        assert "Match Report" in result.stdout

    def test_mock_book_only_flag(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--book-only"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        for match in data["matches"]:
            assert match["decision"] == "BOOK"

    def test_mock_min_score_filter(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--mock", "--min-score", "0.6"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        data = json.loads(result.stdout)
        for match in data["matches"]:
            assert match["score"]["total"] >= 0.6

    def test_help_flag(self):
        result = subprocess.run(
            [PYTHON, WORKER_PATH, "--help"],
            capture_output=True, text=True, encoding="utf-8",
        )
        assert result.returncode == 0
        assert "Matchmaker" in result.stdout or "usage" in result.stdout.lower()
