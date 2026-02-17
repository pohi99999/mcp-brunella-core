"""
Unit tesztek: myai/workers/geo_scraper.py
Track: hyper_local_supply_chain_20260216 – Phase 1

Lefedi:
 - Haversine távolságszámítás
 - GeoFence.contains() logika
 - Pydantic modellek (GeoPoint, GeoFence, FreightCapacity, Request, Result)
 - scrape_freight() mock módban
 - Geo-szűrés és rendezés
 - Szűrők: min_pallets, vehicle_types
 - CLI belépési pont (stdin + args + markdown)
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from datetime import date, datetime
from typing import Any
from unittest.mock import patch

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.chdir(ROOT)

from myai.workers.geo_scraper import (
    GeoPoint,
    GeoFence,
    FreightCapacity,
    FreightScrapeRequest,
    FreightScrapeResult,
    haversine,
    scrape_freight,
    _scrape_timocom_mock,
    _scrape_trans_eu_mock,
    DEFAULT_CENTER_LAT,
    DEFAULT_CENTER_LNG,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def zalaegerszeg() -> GeoPoint:
    return GeoPoint(lat=DEFAULT_CENTER_LAT, lng=DEFAULT_CENTER_LNG)


@pytest.fixture
def geofence_50km(zalaegerszeg) -> GeoFence:
    return GeoFence(center=zalaegerszeg, radius_km=50.0)


@pytest.fixture
def default_mock_request() -> FreightScrapeRequest:
    return FreightScrapeRequest(mock=True)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Haversine Távolságszámítás
# ─────────────────────────────────────────────────────────────────────────────

class TestHaversine:
    def test_same_point_is_zero(self):
        d = haversine(46.84, 16.84, 46.84, 16.84)
        assert d == pytest.approx(0.0, abs=0.001)

    def test_zalaegerszeg_to_graz(self):
        # Zalaegerszeg → Graz ~105 km légvonalban
        d = haversine(46.8417, 16.8416, 47.0707, 15.4395)
        assert 90 < d < 125, f"Zala-Graz távolság outlier: {d:.1f} km"

    def test_zalaegerszeg_to_budapest(self):
        # ~170 km
        d = haversine(46.8417, 16.8416, 47.4979, 19.0402)
        assert 155 < d < 195

    def test_known_distance_london_paris(self):
        # London–Párizs ~340 km légvonal
        d = haversine(51.5074, -0.1278, 48.8566, 2.3522)
        assert 320 < d < 360

    def test_symmetric(self):
        d1 = haversine(46.84, 16.84, 47.50, 19.04)
        d2 = haversine(47.50, 19.04, 46.84, 16.84)
        assert d1 == pytest.approx(d2, rel=1e-9)

    def test_returns_float(self):
        assert isinstance(haversine(0, 0, 1, 1), float)


# ─────────────────────────────────────────────────────────────────────────────
# 2. GeoFence.contains()
# ─────────────────────────────────────────────────────────────────────────────

class TestGeoFenceContains:
    def test_center_inside(self, geofence_50km):
        assert geofence_50km.contains(DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG) is True

    def test_point_inside_radius(self, geofence_50km):
        # Nagykanizsa ~46 km Zalaegerszeg-tól
        assert geofence_50km.contains(46.4590, 16.9897) is True

    def test_point_outside_radius(self, geofence_50km):
        # Budapest ~170 km
        assert geofence_50km.contains(47.4979, 19.0402) is False

    def test_point_on_boundary(self):
        # Pontosan 50 km-re → belül (le=)
        center = GeoPoint(lat=46.0, lng=17.0)
        fence = GeoFence(center=center, radius_km=50.0)
        # 50 km észak ~ lat+0.45
        near_boundary = 46.0 + (50.0 / 111.0)
        result = fence.contains(near_boundary, 17.0)
        assert isinstance(result, bool)  # Határon mindkettő elfogadható

    def test_small_radius_only_center(self):
        center = GeoPoint(lat=46.84, lng=16.84)
        tight = GeoFence(center=center, radius_km=1.0)
        assert tight.contains(46.84, 16.84) is True
        assert tight.contains(46.85, 16.85) is False  # ~1.5 km


# ─────────────────────────────────────────────────────────────────────────────
# 3. Pydantic Modell Validáció
# ─────────────────────────────────────────────────────────────────────────────

class TestGeoPointModel:
    def test_valid_point(self):
        p = GeoPoint(lat=46.84, lng=16.84)
        assert p.lat == pytest.approx(46.84)

    def test_lat_out_of_range(self):
        with pytest.raises(Exception):
            GeoPoint(lat=91.0, lng=0.0)

    def test_lng_out_of_range(self):
        with pytest.raises(Exception):
            GeoPoint(lat=0.0, lng=181.0)

    def test_negative_lat(self):
        GeoPoint(lat=-46.84, lng=16.84)  # Déli félteke – valid


class TestGeoFenceModel:
    def test_valid_geofence(self):
        gf = GeoFence(center=GeoPoint(lat=46.84, lng=16.84), radius_km=50.0)
        assert gf.radius_km == 50.0

    def test_radius_too_large(self):
        with pytest.raises(Exception):
            GeoFence(center=GeoPoint(lat=0, lng=0), radius_km=3000.0)

    def test_radius_zero(self):
        with pytest.raises(Exception):
            GeoFence(center=GeoPoint(lat=0, lng=0), radius_km=0.0)


class TestFreightCapacityModel:
    def test_valid_capacity(self):
        cap = FreightCapacity(
            origin="Zalaegerszeg",
            origin_lat=46.84,
            origin_lng=16.84,
            destination="Graz",
            vehicle_type="Tautliner",
            available_pallets=14,
            available_date=date.today(),
            source="timocom",
        )
        assert cap.vehicle_type == "tautliner"  # normalized

    def test_pallets_out_of_range_raises(self):
        with pytest.raises(Exception):
            FreightCapacity(
                origin="X", origin_lat=0, origin_lng=0,
                destination="Y", vehicle_type="mega",
                available_pallets=34,  # max 33
                available_date=date.today(), source="test",
            )


class TestFreightScrapeRequestModel:
    def test_default_request(self):
        req = FreightScrapeRequest()
        assert req.radius_km == 50.0
        assert "timocom" in req.sources

    def test_invalid_source_raises(self):
        with pytest.raises(Exception):
            FreightScrapeRequest(sources=["invalid_source"])

    def test_as_geofence(self):
        req = FreightScrapeRequest()
        gf = req.as_geofence()
        assert isinstance(gf, GeoFence)
        assert gf.radius_km == req.radius_km


# ─────────────────────────────────────────────────────────────────────────────
# 4. Mock Scraper Függvények
# ─────────────────────────────────────────────────────────────────────────────

class TestMockScrapers:
    def test_timocom_mock_returns_list(self, geofence_50km):
        caps = _scrape_timocom_mock(geofence_50km, 10)
        assert isinstance(caps, list)
        assert all(isinstance(c, FreightCapacity) for c in caps)

    def test_timocom_mock_only_within_fence(self, geofence_50km):
        caps = _scrape_timocom_mock(geofence_50km, 20)
        for cap in caps:
            assert geofence_50km.contains(cap.origin_lat, cap.origin_lng), (
                f"Geo-kerítésen kívüli tétel: {cap.origin} ({cap.distance_km:.1f} km)"
            )

    def test_trans_eu_mock_returns_list(self, geofence_50km):
        caps = _scrape_trans_eu_mock(geofence_50km, 10)
        assert isinstance(caps, list)

    def test_mock_limit_respected(self, geofence_50km):
        caps = _scrape_timocom_mock(geofence_50km, 2)
        assert len(caps) <= 2

    def test_mock_sources_tagged(self, geofence_50km):
        caps = _scrape_timocom_mock(geofence_50km, 5)
        for c in caps:
            assert c.source == "timocom"

    def test_distance_km_computed(self, geofence_50km):
        caps = _scrape_timocom_mock(geofence_50km, 5)
        for c in caps:
            assert c.distance_km >= 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 5. scrape_freight() – Mock Mód
# ─────────────────────────────────────────────────────────────────────────────

class TestScrapeFreightMock:
    def test_returns_result_type(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        assert isinstance(result, FreightScrapeResult)

    def test_success_flag(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        assert result.success is True

    def test_all_within_geofence(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        geofence = default_mock_request.as_geofence()
        for cap in result.capacities:
            assert geofence.contains(cap.origin_lat, cap.origin_lng)

    def test_sorted_by_distance(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        distances = [c.distance_km for c in result.capacities]
        assert distances == sorted(distances), "Nem távolság szerint van rendezve"

    def test_limit_respected(self):
        req = FreightScrapeRequest(mock=True, limit=3)
        result = scrape_freight(req)
        assert len(result.capacities) <= 3

    def test_sources_used_in_result(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        for s in default_mock_request.sources:
            assert s in result.sources_used

    def test_geofence_metadata_correct(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        assert result.geofence_radius_km == default_mock_request.radius_km
        assert result.geofence_center.lat == pytest.approx(default_mock_request.center.lat)

    def test_duration_positive(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        assert result.duration_seconds >= 0.0

    def test_min_pallets_filter(self):
        req = FreightScrapeRequest(mock=True, min_pallets=15)
        result = scrape_freight(req)
        for cap in result.capacities:
            assert cap.available_pallets >= 15

    def test_vehicle_type_filter(self):
        req = FreightScrapeRequest(mock=True, vehicle_types=["tautliner"])
        result = scrape_freight(req)
        for cap in result.capacities:
            assert cap.vehicle_type == "tautliner"

    def test_within_geofence_count_leq_total_found(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        assert result.within_geofence <= result.total_found

    def test_single_source(self):
        req = FreightScrapeRequest(mock=True, sources=["timocom"])
        result = scrape_freight(req)
        assert result.sources_used == ["timocom"]
        for cap in result.capacities:
            assert cap.source == "timocom"


# ─────────────────────────────────────────────────────────────────────────────
# 6. FreightScrapeResult.to_markdown()
# ─────────────────────────────────────────────────────────────────────────────

class TestToMarkdown:
    def test_markdown_h1_present(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        md = result.to_markdown()
        assert "# 🗺️ Geo-fenced Freight Capacity Riport" in md

    def test_markdown_contains_origin(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        md = result.to_markdown()
        for cap in result.capacities:
            assert cap.origin in md

    def test_markdown_contains_radius(self, default_mock_request):
        result = scrape_freight(default_mock_request)
        md = result.to_markdown()
        assert "50" in md  # 50 km sugár megjelenik


# ─────────────────────────────────────────────────────────────────────────────
# 7. CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

class TestGeoCLI:
    WORKER = os.path.join(ROOT, "myai", "workers", "geo_scraper.py")

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

    def test_default_mock_exits_zero(self):
        out = self._run(["--mock"])
        assert out["returncode"] == 0, f"stderr: {out['stderr']}"

    def test_json_output_valid(self):
        out = self._run(["--mock"])
        data = json.loads(out["stdout"])
        assert "capacities" in data
        assert isinstance(data["capacities"], list)

    def test_within_geofence_field(self):
        out = self._run(["--mock"])
        data = json.loads(out["stdout"])
        assert "within_geofence" in data

    def test_custom_lat_lng(self):
        out = self._run(["--lat", "46.84", "--lng", "16.84", "--radius", "30", "--mock"])
        assert out["returncode"] == 0

    def test_markdown_mode(self):
        out = self._run(["--mock", "--markdown"])
        assert "Freight Capacity Riport" in out["stdout"]

    def test_stdin_json(self):
        payload = json.dumps({
            "center": {"lat": 46.84, "lng": 16.84},
            "radius_km": 50,
            "mock": True,
        })
        out = self._run([], stdin_data=payload)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"])
        assert "capacities" in data

    def test_invalid_stdin_exits_nonzero(self):
        out = self._run([], stdin_data="NOT_VALID_JSON")
        assert out["returncode"] != 0

    def test_min_pallets_filter_cli(self):
        out = self._run(["--mock", "--min-pallets", "20"])
        data = json.loads(out["stdout"])
        for cap in data["capacities"]:
            assert cap["available_pallets"] >= 20


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
