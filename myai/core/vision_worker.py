"""
🏠 Real Estate Vision Worker – Gemini Vision OCR & Property Document Analysis
Track: real_estate_sales_campaign_20260216 – Phase 1

Glass Box: Ingatlan dokumentumok (PDF, JPG, PNG) feldolgozása Gemini Vision API-val.
           HRSZ, alapterület, közművek, tulajdonos adatok kinyerése strukturált
           PropertyAsset JSON-ba.

Használat:
    python vision_worker.py --file plan.pdf [--mock]
    python vision_worker.py --file kep.jpg --format json
    echo '{"file_path": "doc.pdf", "mock": true}' | python vision_worker.py
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Modellek
# ─────────────────────────────────────────────────────────────────────────────

class PropertyUtilities(BaseModel):
    """Közmű információk."""
    electricity: bool = False
    gas: bool = False
    water: bool = False
    sewage: bool = False
    internet: bool = False
    notes: str = ""


class PropertyAddress(BaseModel):
    """Ingatlan pontos cím adatai."""
    country: str = "HU"
    zip_code: str = ""
    city: str = ""
    street: str = ""
    house_number: str = ""
    floor: Optional[str] = None
    formatted: str = ""

    @field_validator("zip_code")
    @classmethod
    def validate_zip(cls, v: str) -> str:
        return v.strip()


class PropertyAsset(BaseModel):
    """
    Teljes ingatlan adat struktúra.
    Kiinduló forrás: OCR / Gemini Vision elemzés.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_file: str = ""
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    # Azonosítók
    hrsz: str = ""                      # Helyrajzi szám
    ownership_id: str = ""              # Tulajdoni lap szám
    land_registry_number: str = ""      # Ingatlan-nyilvántartási szám

    # Típus
    property_type: Literal[
        "apartment", "house", "land", "commercial", "industrial", "storage", "other"
    ] = "other"
    sub_type: str = ""                  # Részletesebb típus (pl. "panel lakás")

    # Méret
    area_sqm: Optional[float] = None    # Nettó alapterület m²
    lot_size_sqm: Optional[float] = None  # Telekterület m²
    rooms: Optional[int] = None
    floors: Optional[int] = None
    floor_level: Optional[int] = None   # Melyik emeleten van

    # Cím
    address: PropertyAddress = Field(default_factory=PropertyAddress)

    # Közmű
    utilities: PropertyUtilities = Field(default_factory=PropertyUtilities)

    # Pénzügy
    asking_price_eur: Optional[float] = None
    estimated_value_eur: Optional[float] = None
    price_per_sqm_eur: Optional[float] = None

    # Jogi státusz
    legal_status: str = ""              # "szabad", "terhelt", "haszonélvezeti jog"
    encumbrances: list[str] = Field(default_factory=list)

    # Gyártási/építési adatok
    year_built: Optional[int] = None
    last_renovation: Optional[int] = None
    energy_class: str = ""              # pl. "BB", "CC"

    # Leírás, megjegyzések
    description: str = ""
    notes: str = ""
    raw_text: str = ""                  # OCR nyers szöveg

    # Minőség, magabiztosság
    confidence: float = 0.0            # 0.0 – 1.0 (kinyerés megbízhatósága)
    ocr_quality: str = "unknown"        # "good", "medium", "poor"

    def to_markdown(self) -> str:
        lines = [
            "# 🏠 PropertyAsset Elemzés",
            "",
            f"**ID:** `{self.id}`  ",
            f"**Forrás fájl:** `{self.source_file}`  ",
            f"**HRSZ:** {self.hrsz or '–'}  ",
            f"**Típus:** {self.property_type} / {self.sub_type or '–'}  ",
            f"**Alapterület:** {self.area_sqm or '–'} m²  ",
            f"**Telek:** {self.lot_size_sqm or '–'} m²  ",
            f"**Szobák:** {self.rooms or '–'}  ",
            f"**Épített:** {self.year_built or '–'}  ",
            f"**Cím:** {self.address.formatted or '–'}  ",
            f"**Ár:** {self.asking_price_eur or '–'} EUR  ",
            f"**Megbízhatóság:** {self.confidence:.0%}  ",
            "",
            "## Közmű",
            f"- Villany: {'✅' if self.utilities.electricity else '❌'}",
            f"- Gáz: {'✅' if self.utilities.gas else '❌'}",
            f"- Víz: {'✅' if self.utilities.water else '❌'}",
            f"- Csatorna: {'✅' if self.utilities.sewage else '❌'}",
        ]
        if self.description:
            lines += ["", "## Leírás", self.description]
        if self.encumbrances:
            lines += ["", "## Terhek"] + [f"- {e}" for e in self.encumbrances]
        return "\n".join(lines)


class VisionRequest(BaseModel):
    """OCR feldolgozási kérés."""
    file_path: str
    mock: bool = False
    output_format: Literal["json", "markdown"] = "json"
    language: str = "hu"               # OCR hint


class VisionResponse(BaseModel):
    """OCR folyamat válasza."""
    success: bool
    file_path: str
    asset: Optional[PropertyAsset] = None
    raw_text: str = ""
    error: str = ""
    duration_seconds: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# OCR Minták (Mock adatok teszteléshez)
# ─────────────────────────────────────────────────────────────────────────────

_MOCK_ASSETS: list[dict] = [
    {
        "source_file": "tulajdoni_lap_01.pdf",
        "hrsz": "1234/A",
        "property_type": "apartment",
        "sub_type": "panel lakás",
        "area_sqm": 68.5,
        "rooms": 3,
        "floor_level": 4,
        "floors": 10,
        "year_built": 1982,
        "address": {
            "country": "HU", "zip_code": "1117", "city": "Budapest",
            "street": "Bogdánfy utca", "house_number": "10",
            "formatted": "1117 Budapest, Bogdánfy utca 10."
        },
        "utilities": {"electricity": True, "gas": True, "water": True, "sewage": True},
        "legal_status": "szabad",
        "asking_price_eur": 125000,
        "confidence": 0.91,
        "ocr_quality": "good",
        "raw_text": "Tulajdoni Lap Kivonat\nHRSZ: 1234/A\nCím: 1117 Budapest, Bogdánfy u. 10.\nAlapterület: 68.5 m²\nSzobák: 3\n...",
    },
    {
        "source_file": "teleklapkivonat_02.jpg",
        "hrsz": "5678",
        "property_type": "land",
        "sub_type": "belterületi telek",
        "lot_size_sqm": 1200.0,
        "address": {
            "country": "HU", "zip_code": "2000", "city": "Szentendre",
            "street": "Kossuth Lajos utca", "house_number": "22",
            "formatted": "2000 Szentendre, Kossuth L. u. 22."
        },
        "utilities": {"electricity": True, "water": True},
        "legal_status": "szabad",
        "year_built": None,
        "asking_price_eur": 78000,
        "confidence": 0.84,
        "ocr_quality": "medium",
        "raw_text": "Telekcsoport: 5678\nTelekterület: 1200 m²\nBeépíthetőség: 40%\n...",
    },
    {
        "source_file": "haz_dokumentum_03.pdf",
        "hrsz": "91011/B",
        "property_type": "house",
        "sub_type": "családi ház",
        "area_sqm": 145.0,
        "lot_size_sqm": 850.0,
        "rooms": 5,
        "floors": 2,
        "year_built": 1998,
        "last_renovation": 2017,
        "energy_class": "BB",
        "address": {
            "country": "HU", "zip_code": "9028", "city": "Győr",
            "street": "Virág utca", "house_number": "5",
            "formatted": "9028 Győr, Virág utca 5."
        },
        "utilities": {"electricity": True, "gas": True, "water": True, "sewage": True, "internet": True},
        "legal_status": "terhelt",
        "encumbrances": ["Jelzálogjog – K&H Bank Zrt.", "Elidegenítési tilalom 2028-ig"],
        "asking_price_eur": 195000,
        "confidence": 0.88,
        "ocr_quality": "good",
        "raw_text": "Ingatlan-nyilvántartás kivonat\nHRSZ: 91011/B\nCsaládi ház 145 m²\nTelekterület: 850 m²\nTeher: Jelzálog K&H...",
    },
]


def _mock_process(file_path: str) -> PropertyAsset:
    """Mock OCR feldolgozás – fájlnév alapján."""
    import hashlib
    h = int(hashlib.md5(file_path.encode()).hexdigest(), 16)
    raw = _MOCK_ASSETS[h % len(_MOCK_ASSETS)].copy()
    raw["source_file"] = file_path
    # Nest-elt adatok rekonstrukciója
    raw["address"] = PropertyAddress(**raw["address"])
    raw["utilities"] = PropertyUtilities(**raw["utilities"])
    return PropertyAsset(**raw)


# ─────────────────────────────────────────────────────────────────────────────
# Alapvető szöveg-kinyerési segédletek
# ─────────────────────────────────────────────────────────────────────────────

def _extract_hrsz(text: str) -> str:
    """HRSZ kinyerése szövegből."""
    patterns = [
        r"(?:HRSZ|helyrajzi\s*szám)[:\s]+([0-9]+(?:/[A-Z0-9]+)*)",
        r"Telekcsoport[:\s]+([0-9]+(?:/[A-Z0-9]+)*)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def _extract_area(text: str) -> Optional[float]:
    """Alapterület m² kinyerése."""
    patterns = [
        r"(?:alapterület|nettó terület|hasznos[^\d]*terület)[:\s]+([\d,.]+)\s*m",
        r"([\d,.]+)\s*m[²2]\s*(?:alapterület|nettó|hasznos)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1).replace(",", ".").replace(" ", ""))
            except ValueError:
                continue
    return None


def _extract_zip_city(text: str) -> tuple[str, str]:
    """Irányítószám és város kinyerése."""
    m = re.search(r"\b(\d{4})\s+([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+)?)\b", text)
    if m:
        return m.group(1), m.group(2)
    return "", ""


def _extract_price(text: str) -> Optional[float]:
    """Ár kinyerése HUF-ból EUR-ba konvertálva (közelítő)."""
    m = re.search(r"(?:vételár|ár)[:\s]+([\d\s.,]+)\s*(?:Ft|HUF|EUR|€)", text, re.IGNORECASE)
    if m:
        raw = m.group(1).replace(" ", "").replace(".", "").replace(",", ".")
        try:
            val = float(raw)
            # HUF → EUR ha nagy szám (> 10000 → valószínűleg HUF)
            if val > 10_000:
                val = round(val * 0.00252, 2)
            return val
        except ValueError:
            pass
    return None


def _calc_confidence(asset: dict) -> float:
    """Megbízhatóság számítása a kitöltött mezők alapján."""
    key_fields = ["hrsz", "area_sqm", "property_type", "address", "legal_status"]
    filled = sum(1 for f in key_fields if asset.get(f) not in (None, "", {}, []))
    return round(filled / len(key_fields), 2)


def _parse_text_to_asset(text: str, file_path: str) -> PropertyAsset:
    """Nyers OCR szövegből PropertyAsset kinyerése heurisztikával."""
    hrsz = _extract_hrsz(text)
    area = _extract_area(text)
    zip_code, city = _extract_zip_city(text)
    price_eur = _extract_price(text)

    # Típus felismerés
    prop_type: Literal["apartment", "house", "land", "commercial", "industrial", "storage", "other"] = "other"
    if any(w in text.lower() for w in ["lakás", "apartman", "apartament"]):
        prop_type = "apartment"
    elif any(w in text.lower() for w in ["ház", "villa", "nyaraló"]):
        prop_type = "house"
    elif any(w in text.lower() for w in ["telek", "föld", "mező", "tanya"]):
        prop_type = "land"
    elif any(w in text.lower() for w in ["iroda", "üzlet", "commercial"]):
        prop_type = "commercial"

    # Közmű
    util = PropertyUtilities(
        electricity="villany" in text.lower() or "elektrom" in text.lower(),
        gas="gáz" in text.lower() or ("gas" in text.lower() and "garage" not in text.lower()),
        water="víz" in text.lower() or "water" in text.lower(),
        sewage="csatorna" in text.lower() or "szennyvíz" in text.lower(),
        internet="internet" in text.lower() or "broadband" in text.lower(),
    )

    # Jogi terhek kinyerése
    encumbrances: list[str] = []
    for line in text.split("\n"):
        if any(k in line.lower() for k in ["jelzálog", "haszonélvezet", "elidegenítési", "végrehajtás"]):
            encumbrances.append(line.strip())

    asset_data: dict = {
        "source_file": file_path,
        "hrsz": hrsz,
        "property_type": prop_type,
        "area_sqm": area,
        "address": PropertyAddress(zip_code=zip_code, city=city),
        "utilities": util,
        "asking_price_eur": price_eur,
        "encumbrances": encumbrances,
        "raw_text": text[:2000],
        "ocr_quality": "medium",
    }
    asset_data["confidence"] = _calc_confidence(asset_data)
    return PropertyAsset(**asset_data)


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Vision OCR integráció
# ─────────────────────────────────────────────────────────────────────────────

def _encode_image_base64(file_path: str) -> str:
    """Kép fájl base64 kódolása."""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _gemini_vision_ocr(file_path: str) -> str:
    """
    Gemini Vision API hívás ingatlan dokumentum OCR-hez.

    Visszaad: nyers kinyert szöveg (str)
    Környezeti változó: GEMINI_API_KEY
    """
    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        raise ImportError(
            "google-generativeai csomag szükséges: pip install google-generativeai"
        )

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY hiányzik a környezetből.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    ext = Path(file_path).suffix.lower()
    supported_image = ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")
    supported_pdf = ext == ".pdf"

    if not (supported_image or supported_pdf):
        raise ValueError(f"Nem támogatott fájlformátum: {ext}")

    prompt = (
        "Te egy ingatlan dokumentum elemző rendszer vagy. "
        "Kinyerd a következő mezőket a dokumentumból strukturált formában:\n"
        "- HRSZ (helyrajzi szám)\n"
        "- Ingatlan típusa (lakás, ház, telek, iroda, ipari)\n"
        "- Alapterület m²\n"
        "- Telekterület m²\n"
        "- Szobák száma\n"
        "- Emelet száma\n"
        "- Építés éve\n"
        "- Cím (irányítószám, város, utca)\n"
        "- Közművek (villany, gáz, víz, csatorna, internet)\n"
        "- Jogi státusz (szabad, terhelt)\n"
        "- Terhek (jelzálog, haszonélvezet stb.)\n"
        "- Ár (Ft vagy EUR)\n\n"
        "Válaszolj magyarázat nélkül, csak a kinyert szöveggel, mezőnként új sorban."
    )

    if supported_image:
        img_data = _encode_image_base64(file_path)
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                    ".webp": "image/webp", ".gif": "image/gif"}
        mime = mime_map.get(ext, "image/jpeg")
        content = [{"inline_data": {"mime_type": mime, "data": img_data}}, prompt]
    else:
        # PDF: szöveg kiolvasása + Vision fallback
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        content = [
            {"inline_data": {"mime_type": "application/pdf", "data": base64.b64encode(pdf_bytes).decode()}},
            prompt
        ]

    response = model.generate_content(content)
    return response.text


# ─────────────────────────────────────────────────────────────────────────────
# Fő Feldolgozó
# ─────────────────────────────────────────────────────────────────────────────

def process_document(request: VisionRequest) -> VisionResponse:
    """
    Dokumentum feldolgozás: OCR → PropertyAsset.

    Mock módban fájlnév alapján szimulált adatot ad vissza.
    Éles módban Gemini Vision API-t hív.
    """
    import time
    start = time.time()

    if request.mock:
        asset = _mock_process(request.file_path)
        return VisionResponse(
            success=True,
            file_path=request.file_path,
            asset=asset,
            raw_text=asset.raw_text,
            duration_seconds=round(time.time() - start, 3),
        )

    # Éles mód
    if not Path(request.file_path).exists():
        return VisionResponse(
            success=False,
            file_path=request.file_path,
            error=f"Fájl nem található: {request.file_path}",
            duration_seconds=round(time.time() - start, 3),
        )

    try:
        raw_text = _gemini_vision_ocr(request.file_path)
        asset = _parse_text_to_asset(raw_text, request.file_path)
        return VisionResponse(
            success=True,
            file_path=request.file_path,
            asset=asset,
            raw_text=raw_text,
            duration_seconds=round(time.time() - start, 3),
        )
    except Exception as e:
        return VisionResponse(
            success=False,
            file_path=request.file_path,
            error=str(e),
            duration_seconds=round(time.time() - start, 3),
        )


# ─────────────────────────────────────────────────────────────────────────────
# CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Brunella Real Estate Vision Worker")
    parser.add_argument("--file", help="Feldolgozandó dokumentum (PDF/JPG/PNG)")
    parser.add_argument("--mock", action="store_true", help="Mock/tesztelési mód")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    args = parser.parse_args()

    # Stdin JSON
    if not args.file and not sys.stdin.isatty():
        try:
            data = json.loads(sys.stdin.read())
            req = VisionRequest(**data)
        except Exception as e:
            print(json.dumps({"error": f"Érvénytelen stdin JSON: {e}"}))
            sys.exit(1)
    elif args.file:
        req = VisionRequest(
            file_path=args.file,
            mock=args.mock,
            output_format=args.format,
        )
    else:
        print(json.dumps({"error": "Add meg a --file argumentumot!"}))
        sys.exit(1)

    result = process_document(req)

    if args.format == "markdown" and result.asset:
        print(result.asset.to_markdown())
    else:
        print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
