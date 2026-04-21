# -*- coding: utf-8 -*-
"""
Tesztek: myai/core/vision_worker.py
Track: real_estate_sales_campaign_20260216 – Phase 1

10+ szcenárió:
  - Mock feldolgozás (3 különböző fájl)
  - PropertyAsset validáció (minden mező)
  - OCR heurisztika (HRSZ, terület, cím, ár kinyerés)
  - Konfidencia számítás
  - CLI belépési pont
  - Hibakezelés (nem létező fájl, üres feladat)
  - Markdown kimenet
"""
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime

import pytest

# ── Importok ─────────────────────────────────────────────────────────────────
ROOT = str(Path(__file__).parent.parent.parent)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from myai.core.vision_worker import (
    PropertyAsset,
    PropertyAddress,
    PropertyUtilities,
    PropertyValuation,
    PropertyAnalysisResult,
    VisionRequest,
    VisionResponse,
    _mock_process,
    _extract_hrsz,
    _extract_area,
    _extract_zip_city,
    _extract_price,
    _calc_confidence,
    _parse_text_to_asset,
    process_document,
)

# ─────────────────────────────────────────────────────────────────────────────
# Fixture-ök
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_ocr_text() -> str:
    return """Tulajdoni Lap Kivonat
HRSZ: 2345/B
Cím: 1056 Budapest, Veres Pálné utca 7.
Alapterület: 95.5 m²
Szobák: 4
Emelet: 3
Épített: 1998
Vételár: 180 000 000 Ft
Teher: Jelzálogjog – OTP Bank Zrt.
Villany: becsatlakoztatva
Gáz: bekötve
Víz: megoszló
Csatorna: van
"""

@pytest.fixture
def sample_land_text() -> str:
    return """Telekcsoport: 8899
Telekterület: 2500 m²
Tanya / mezőgazdasági terület
Irányítószám: 6000, Kecskemét
Vételár: 45 000 EUR
Villany: van
Csatorna: nincs
"""

@pytest.fixture
def apartment_asset() -> PropertyAsset:
    return _mock_process("tulajdoni_lap_01.pdf")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Mock feldolgozás – 3 különböző fájlra
# ─────────────────────────────────────────────────────────────────────────────

class TestMockProcess:
    def test_apartment_mock(self):
        asset = _mock_process("tulajdoni_lap_01.pdf")
        assert asset is not None
        assert asset.property_type == "apartment"
        assert asset.hrsz == "1234/A"
        assert asset.area_sqm == 68.5
        assert asset.confidence > 0.8

    def test_land_mock(self):
        asset = _mock_process("teleklapkivonat_02.jpg")
        assert asset is not None
        assert asset.property_type == "land"
        assert asset.lot_size_sqm == 1200.0

    def test_house_mock(self):
        asset = _mock_process("haz_dokumentum_03.pdf")
        assert asset is not None
        assert asset.property_type == "house"
        assert asset.encumbrances  # Terhes ingatlan
        assert len(asset.encumbrances) >= 1

    def test_deterministic_mock(self):
        """Ugyanaz a fájlnév → ugyanaz az eredmény."""
        a1 = _mock_process("test.pdf")
        a2 = _mock_process("test.pdf")
        assert a1.hrsz == a2.hrsz
        assert a1.property_type == a2.property_type

    def test_different_files_different_results(self):
        """Különböző fájlnevek → különböző eredmény (vagy legalább különböző source_file)."""
        a1 = _mock_process("file_alpha.pdf")
        a2 = _mock_process("file_beta.pdf")
        assert a1.source_file != a2.source_file


# ─────────────────────────────────────────────────────────────────────────────
# 2. PropertyAsset mező validáció
# ─────────────────────────────────────────────────────────────────────────────

class TestPropertyAsset:
    def test_required_fields(self, apartment_asset):
        assert apartment_asset.id
        assert apartment_asset.source_file
        assert isinstance(apartment_asset.extracted_at, datetime)

    def test_address_nested(self, apartment_asset):
        assert isinstance(apartment_asset.address, PropertyAddress)
        assert apartment_asset.address.city == "Budapest"

    def test_utilities_nested(self, apartment_asset):
        assert isinstance(apartment_asset.utilities, PropertyUtilities)
        assert apartment_asset.utilities.electricity is True
        assert apartment_asset.utilities.water is True

    def test_confidence_range(self, apartment_asset):
        assert 0.0 <= apartment_asset.confidence <= 1.0

    def test_encumbrances_list(self):
        asset = _mock_process("haz_dokumentum_03.pdf")
        assert isinstance(asset.encumbrances, list)
        for e in asset.encumbrances:
            assert isinstance(e, str)

    def test_price_positive(self, apartment_asset):
        assert apartment_asset.asking_price_eur is not None
        assert apartment_asset.asking_price_eur > 0

    def test_year_built_valid(self, apartment_asset):
        if apartment_asset.year_built:
            assert 1800 <= apartment_asset.year_built <= 2026

    def test_markdown_output(self, apartment_asset):
        md = apartment_asset.to_markdown()
        assert "PropertyAsset" in md
        assert "HRSZ" in md
        assert apartment_asset.hrsz in md


# ─────────────────────────────────────────────────────────────────────────────
# 3. OCR Heurisztika – szövegből kinyerés
# ─────────────────────────────────────────────────────────────────────────────

class TestOcrHeuristics:
    def test_extract_hrsz_standard(self):
        text = "HRSZ: 1234/A\nAlapterület: 50 m²"
        assert _extract_hrsz(text) == "1234/A"

    def test_extract_hrsz_telekcsoport(self):
        text = "Telekcsoport: 8899\nTelekterület: 1200 m²"
        assert _extract_hrsz(text) == "8899"

    def test_extract_hrsz_missing(self):
        assert _extract_hrsz("Nincs HRSZ ebben a szövegben") == ""

    def test_extract_area_sqm(self):
        text = "Alapterület: 95.5 m²"
        assert _extract_area(text) == 95.5

    def test_extract_area_comma(self):
        text = "nettó terület: 68,5 m²"
        assert _extract_area(text) == 68.5

    def test_extract_area_missing(self):
        assert _extract_area("Nincs terület adat") is None

    def test_extract_zip_city(self):
        text = "1117 Budapest, Bogdánfy utca 10."
        zip_code, city = _extract_zip_city(text)
        assert zip_code == "1117"
        assert "Budapest" in city

    def test_extract_price_huf(self):
        text = "Vételár: 180 000 000 Ft"
        price_eur = _extract_price(text)
        # 180M HUF → ~45,360 EUR (0.00252 konverziós)
        assert price_eur is not None
        assert 40_000 < price_eur < 55_000

    def test_extract_price_eur(self):
        text = "Vételár: 45 000 EUR"
        price_eur = _extract_price(text)
        assert price_eur is not None
        assert 44_000 < price_eur < 46_000


# ─────────────────────────────────────────────────────────────────────────────
# 4. Konfidencia számítás
# ─────────────────────────────────────────────────────────────────────────────

class TestConfidenceCalc:
    def test_full_data_high_confidence(self):
        data = {
            "hrsz": "1234/A",
            "area_sqm": 95.5,
            "property_type": "apartment",
            "address": PropertyAddress(
                country="HU", zip_code="1056", city="Budapest",
                street="Veres Pálné u.", house_number="7",
                formatted="1056 Budapest, Veres Pálné u. 7."
            ),
            "legal_status": "szabad",
        }
        conf = _calc_confidence(data)
        assert conf >= 0.8

    def test_empty_data_low_confidence(self):
        conf = _calc_confidence({})
        assert conf == 0.0

    def test_partial_data_mid_confidence(self):
        data = {"hrsz": "1234/A", "area_sqm": 50.0}
        conf = _calc_confidence(data)
        assert 0.0 < conf < 1.0


# ─────────────────────────────────────────────────────────────────────────────
# 5. Teljes szöveg-feldolgozás: _parse_text_to_asset
# ─────────────────────────────────────────────────────────────────────────────

class TestParseTextToAsset:
    def test_apartment_text(self, sample_ocr_text):
        asset = _parse_text_to_asset(sample_ocr_text, "test_doc.pdf")
        assert asset.hrsz == "2345/B"
        assert asset.area_sqm == 95.5
        assert asset.property_type == "apartment"
        assert asset.utilities.electricity is True
        assert asset.utilities.gas is True
        assert asset.utilities.water is True
        assert any("OTP" in e for e in asset.encumbrances)

    def test_land_text(self, sample_land_text):
        asset = _parse_text_to_asset(sample_land_text, "telek.pdf")
        assert asset.hrsz == "8899"
        assert asset.property_type == "land"
        assert asset.address.city == "Kecskemét"


# ─────────────────────────────────────────────────────────────────────────────
# 6. process_document (mock mód)
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessDocument:
    def test_mock_success(self):
        req = VisionRequest(file_path="telekcsoport_02.jpg", mock=True)
        resp = process_document(req)
        assert resp.success is True
        assert resp.asset is not None
        assert resp.duration_seconds >= 0

    def test_mock_all_three_types(self):
        files = ["tulajdoni_lap_01.pdf", "teleklapkivonat_02.jpg", "haz_dokumentum_03.pdf"]
        for f in files:
            req = VisionRequest(file_path=f, mock=True)
            resp = process_document(req)
            assert resp.success is True
            assert resp.asset is not None

    def test_live_mode_missing_file(self):
        req = VisionRequest(file_path="/nem/letezik.pdf", mock=False)
        resp = process_document(req)
        assert resp.success is False
        assert "nem található" in resp.error or "nem található" in (resp.error or "")

    def test_response_schema(self):
        req = VisionRequest(file_path="test.pdf", mock=True)
        resp = process_document(req)
        # VisionResponse séma ellenőrzés
        data = json.loads(resp.model_dump_json())
        assert "success" in data
        assert "file_path" in data
        assert "duration_seconds" in data


# ─────────────────────────────────────────────────────────────────────────────
# 7. CLI belépési pont
# ─────────────────────────────────────────────────────────────────────────────

class TestCliEntryPoint:
    WORKER = Path(__file__).parent.parent / "core" / "vision_worker.py"

    def test_cli_mock_file(self):
        result = subprocess.run(
            [sys.executable, str(self.WORKER), "--file", "test_plan.pdf", "--mock"],
            capture_output=True, text=True, cwd=Path(__file__).parent.parent,
        )
        assert result.returncode == 0, f"STDERR: {result.stderr}"
        resp = json.loads(result.stdout)
        assert resp["success"] is True
        assert "asset" in resp

    def test_cli_markdown_output(self):
        result = subprocess.run(
            [sys.executable, str(self.WORKER), "--file", "test.pdf", "--mock", "--format", "markdown"],
            capture_output=True, text=True, cwd=Path(__file__).parent.parent,
        )
        assert result.returncode == 0
        assert "PropertyAsset" in result.stdout

    def test_cli_no_args(self):
        result = subprocess.run(
            [sys.executable, str(self.WORKER)],
            capture_output=True, text=True, cwd=Path(__file__).parent.parent,
        )
        assert result.returncode == 1
        err_data = json.loads(result.stdout)
        assert "error" in err_data

    def test_cli_stdin_json(self):
        payload = json.dumps({"file_path": "stdin_test.pdf", "mock": True})
        result = subprocess.run(
            [sys.executable, str(self.WORKER)],
            input=payload, capture_output=True, text=True,
            cwd=Path(__file__).parent.parent,
        )
        assert result.returncode == 0
        resp = json.loads(result.stdout)
        assert resp["success"] is True
