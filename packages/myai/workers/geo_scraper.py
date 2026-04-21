"""
🗺️ Geo-fenced Freight Capacity Scraper
Track: hyper_local_supply_chain_20260216 – Phase 1

Glass Box: Geo-kerítéssel szűrt logisztikai kapacitás adatgyűjtés.
- GeoFence: középpont (lat/lng) + sugár (km)
- Haversine távolságszámítás
- 2 forrás: TIMOCOM + Trans.eu (live stub + mock mód)
- Human-in-the-loop outreach pipeline alapja

Használat:
    python geo_scraper.py --lat 46.84 --lng 16.84 --radius 50 [--mock]
    echo '{"center": {"lat": 46.84, "lng": 16.84}, "radius_km": 50, "mock": true}' | python geo_scraper.py
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from datetime import date, datetime
from typing import Literal, Optional

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from pydantic import BaseModel, Field, field_validator, model_validator

# ─────────────────────────────────────────────────────────────────────────────
# Konstansok
# ─────────────────────────────────────────────────────────────────────────────

# Ismert freight exchange oldalak (éles scrape célpontok)
SOURCES = {
    "timocom": "https://www.timocom.com/en/freight-exchange",
    "trans_eu": "https://trans.eu/freight-exchange",
}

# Felhasználói agent rotáció (anti-bot)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Firefox/122.0",
]

# Zalaegerszeg koordináták (alapértelmezett geo-kerítés közepei)
DEFAULT_CENTER_LAT = 46.8417
DEFAULT_CENTER_LNG = 16.8416

SCRAPE_DELAY_MIN = 1.5  # MP – lassított navigáció (anti-bot)
SCRAPE_DELAY_MAX = 3.5


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Modellek
# ─────────────────────────────────────────────────────────────────────────────


class GeoPoint(BaseModel):
    """Földrajzi koordináta."""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Szélességi fok")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Hosszúsági fok")


class GeoFence(BaseModel):
    """Körkeresési terület."""
    center: GeoPoint
    radius_km: float = Field(..., gt=0.0, le=2000.0, description="Sugár km-ben")

    def contains(self, lat: float, lng: float) -> bool:
        """Ellenőrzi, hogy egy pont a geo-kerítésen belül van-e."""
        return haversine(self.center.lat, self.center.lng, lat, lng) <= self.radius_km


class FreightCapacity(BaseModel):
    """Egy fuvari kapacitás tétel egy freight exchange-ről."""
    id: str = Field(default="", description="Egyedi azon. (forrás alapú)")
    origin: str = Field(..., description="Indulási helyszín")
    origin_lat: float = Field(..., ge=-90.0, le=90.0)
    origin_lng: float = Field(..., ge=-180.0, le=180.0)
    destination: str = Field(..., description="Célállomás")
    vehicle_type: str = Field(..., description="Jármű típusa (pl. tautliner, flatbed)")
    available_pallets: int = Field(..., ge=0, le=33, description="Szabad raklapszám")
    available_date: date = Field(..., description="Mikor elérhető")
    contact: str = Field(default="", description="Fuvarozó neve/cégneve")
    contact_ref: str = Field(default="", description="Ajánlatszám / belső hivatkozás")
    source: str = Field(..., description="Adatforrás neve (pl. timocom, trans_eu)")
    url: str = Field(default="", description="Forrás URL")
    distance_km: float = Field(default=0.0, description="Távolság a geo-kerítés közepétől")
    currency: str = Field(default="EUR")
    price_per_km: Optional[float] = Field(default=None, description="Ft/EUR per km ha elérhető")
    scraped_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("vehicle_type")
    @classmethod
    def normalize_vehicle_type(cls, v: str) -> str:
        return v.strip().lower()


class FreightScrapeRequest(BaseModel):
    """Scrape kérés egy geo-kerítéssel."""
    center: GeoPoint = Field(
        default_factory=lambda: GeoPoint(lat=DEFAULT_CENTER_LAT, lng=DEFAULT_CENTER_LNG),
        description="Kerítés közepe",
    )
    radius_km: float = Field(default=50.0, gt=0.0, le=2000.0, description="Sugár km-ben")
    limit: int = Field(default=20, ge=1, le=200)
    mock: bool = Field(default=False)
    sources: list[str] = Field(
        default=["timocom", "trans_eu"],
        description="Aktív adatforrások",
    )
    min_pallets: int = Field(default=0, ge=0, description="Minimum raklapszám szűrő")
    vehicle_types: list[str] = Field(default_factory=list, description="Szűrés jármű típusra")

    @model_validator(mode="after")
    def validate_sources(self) -> "FreightScrapeRequest":
        valid = set(SOURCES.keys())
        for s in self.sources:
            if s not in valid:
                raise ValueError(f"Ismeretlen forrás: '{s}'. Elérhető: {valid}")
        return self

    def as_geofence(self) -> GeoFence:
        return GeoFence(center=self.center, radius_km=self.radius_km)


class FreightScrapeResult(BaseModel):
    """Scrape eredmény."""
    capacities: list[FreightCapacity]
    total_found: int
    within_geofence: int
    geofence_center: GeoPoint
    geofence_radius_km: float
    sources_used: list[str]
    duration_seconds: float = 0.0
    success: bool = True
    error_message: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_markdown(self) -> str:
        lines = [
            f"# 🗺️ Geo-fenced Freight Capacity Riport",
            f"",
            f"**Közép:** {self.geofence_center.lat:.4f}°N, {self.geofence_center.lng:.4f}°E  ",
            f"**Sugár:** {self.geofence_radius_km} km  ",
            f"**Talált:** {self.total_found} | **Kerítésen belül:** {self.within_geofence}  ",
            f"**Generálva:** {self.generated_at.isoformat()}  ",
            f"**Időtartam:** {self.duration_seconds:.2f}s",
            "",
            "## 📦 Kapacitások",
            "",
        ]
        for i, cap in enumerate(self.capacities, 1):
            lines.append(f"### {i}. {cap.origin} → {cap.destination}")
            lines.append(f"- **Forrás:** {cap.source}")
            lines.append(f"- **Jármű:** {cap.vehicle_type}")
            lines.append(f"- **Raklapok:** {cap.available_pallets}")
            lines.append(f"- **Dátum:** {cap.available_date}")
            lines.append(f"- **Távolság:** {cap.distance_km:.1f} km")
            if cap.contact:
                lines.append(f"- **Fuvarozó:** {cap.contact}")
            lines.append("")
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Geo Számítások
# ─────────────────────────────────────────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine formula – két GPS koordináta közötti légvonalbeli távolság km-ben.
    """
    R = 6371.0  # Föld sugara km-ben
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


# ─────────────────────────────────────────────────────────────────────────────
# Mock Adatok (Valós Futás Nélkül is Tesztelhető)
# ─────────────────────────────────────────────────────────────────────────────

# Magyar / közép-európai fuvar tételek -– realisztikus GPS koordinátákkal
_MOCK_CARGO_POOL = [
    # Belül: Zalaegerszeg + 50 km
    {
        "origin": "Zalaegerszeg", "origin_lat": 46.8417, "origin_lng": 16.8416,
        "destination": "Graz, AT", "vehicle_type": "tautliner",
        "available_pallets": 14, "contact": "Nagy Fuvar Kft.",
        "price_per_km": 1.45,
    },
    {
        "origin": "Nagykanizsa", "origin_lat": 46.4590, "origin_lng": 16.9897,
        "destination": "Wien, AT", "vehicle_type": "mega",
        "available_pallets": 22, "contact": "Pannonia Logistics",
        "price_per_km": 1.30,
    },
    {
        "origin": "Körmend", "origin_lat": 47.0091, "origin_lng": 16.6013,
        "destination": "Ljubljana, SI", "vehicle_type": "flatbed",
        "available_pallets": 10, "contact": "Kern Trans",
        "price_per_km": 1.55,
    },
    {
        "origin": "Keszthely", "origin_lat": 46.7728, "origin_lng": 17.2410,
        "destination": "Bratislava, SK", "vehicle_type": "tautliner",
        "available_pallets": 18, "contact": "Balaton Cargo",
        "price_per_km": 1.38,
    },
    {
        "origin": "Lenti", "origin_lat": 46.6252, "origin_lng": 16.5413,
        "destination": "Salzburg, AT", "vehicle_type": "curtainsider",
        "available_pallets": 8, "contact": "Gal & Partners",
        "price_per_km": 1.60,
    },
    # Kívül: >50 km a geo-kerítéstől
    {
        "origin": "Budapest", "origin_lat": 47.4979, "origin_lng": 19.0402,
        "destination": "München, DE", "vehicle_type": "mega",
        "available_pallets": 33, "contact": "HU-DE Transport",
        "price_per_km": 1.20,
    },
    {
        "origin": "Pécs", "origin_lat": 46.0727, "origin_lng": 18.2332,
        "destination": "Zagreb, HR", "vehicle_type": "tautliner",
        "available_pallets": 16, "contact": "Pécs Logisztika",
        "price_per_km": 1.35,
    },
    {
        "origin": "Győr", "origin_lat": 47.6875, "origin_lng": 17.6504,
        "destination": "Frankfurt, DE", "vehicle_type": "mega",
        "available_pallets": 30, "contact": "Győr Freight",
        "price_per_km": 1.15,
    },
]


def _build_mock_capacity(raw: dict, source: str, geofence: GeoFence, idx: int) -> FreightCapacity:
    """Rw dict → FreightCapacity konverzió (mock)."""
    dist = haversine(
        geofence.center.lat, geofence.center.lng,
        raw["origin_lat"], raw["origin_lng"],
    )
    return FreightCapacity(
        id=f"{source}_{idx:04d}",
        origin=raw["origin"],
        origin_lat=raw["origin_lat"],
        origin_lng=raw["origin_lng"],
        destination=raw["destination"],
        vehicle_type=raw["vehicle_type"],
        available_pallets=raw["available_pallets"],
        available_date=date.today(),
        contact=raw.get("contact", ""),
        source=source,
        url=SOURCES.get(source, ""),
        distance_km=round(dist, 2),
        price_per_km=raw.get("price_per_km"),
    )


def _scrape_timocom_mock(geofence: GeoFence, limit: int) -> list[FreightCapacity]:
    """TIMOCOM mock: geo-szűrt fuvar kapacitások."""
    pool = _MOCK_CARGO_POOL[:5]  # első 5 – zalaegerszegi régió
    results = []
    for i, raw in enumerate(pool):
        cap = _build_mock_capacity(raw, "timocom", geofence, i)
        if geofence.contains(cap.origin_lat, cap.origin_lng):
            results.append(cap)
        if len(results) >= limit:
            break
    return results


def _scrape_trans_eu_mock(geofence: GeoFence, limit: int) -> list[FreightCapacity]:
    """Trans.eu mock: alternatív forrás, részleges átfedéssel."""
    pool = _MOCK_CARGO_POOL[1:6]  # offset – más tétel sorrend
    results = []
    for i, raw in enumerate(pool):
        cap = _build_mock_capacity(raw, "trans_eu", geofence, i + 100)
        if geofence.contains(cap.origin_lat, cap.origin_lng):
            results.append(cap)
        if len(results) >= limit:
            break
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Live Scrape Stubs (browser-use integráció jövőben)
# ─────────────────────────────────────────────────────────────────────────────

def _scrape_timocom_live(geofence: GeoFence, limit: int) -> list[FreightCapacity]:
    """
    🔴 LIVE – TIMOCOM scrape (browser-use vagy httpx alapú).

    TODO integráció:
    1. playwright / browser-use belépés (reg. szükséges)
    2. POST /freight-exchange/search?lat={lat}&lng={lng}&radius={r}
    3. JSON parse → FreightCapacity lista

    Jelenleg fallback mock-ra.
    """
    print("[INFO] TIMOCOM live scrape stub – mock fallbackre tér vissza", file=sys.stderr)
    return _scrape_timocom_mock(geofence, limit)


def _scrape_trans_eu_live(geofence: GeoFence, limit: int) -> list[FreightCapacity]:
    """
    🔴 LIVE – Trans.eu scrape stub (API-kulcs szükséges).

    TODO integráció:
    1. OAuth2 token: POST https://auth.trans.eu/oauth2/token
    2. GET https://api.trans.eu/ext/freights/v1?origin.lat={lat}&origin.lng={lng}&radius={r}
    3. JSON parse → FreightCapacity lista

    Jelenleg fallback mock-ra.
    """
    print("[INFO] Trans.eu live scrape stub – mock fallbackre tér vissza", file=sys.stderr)
    return _scrape_trans_eu_mock(geofence, limit)


# ─────────────────────────────────────────────────────────────────────────────
# Fő Scraping Függvény
# ─────────────────────────────────────────────────────────────────────────────

def scrape_freight(request: FreightScrapeRequest) -> FreightScrapeResult:
    """
    Geo-fenced freight capacity scraping – fő belépési pont.

    Mock módban offline, statikus adatokkal dolgozik.
    Éles módban live stub-okon keresztül fut (browser-use / API).
    """
    start = time.time()
    geofence = request.as_geofence()
    all_capacities: list[FreightCapacity] = []
    errors: list[str] = []

    scraper_map = {
        "timocom":  (_scrape_timocom_mock  if request.mock else _scrape_timocom_live),
        "trans_eu": (_scrape_trans_eu_mock if request.mock else _scrape_trans_eu_live),
    }

    for source in request.sources:
        fn = scraper_map.get(source)
        if fn is None:
            errors.append(f"Ismeretlen forrás: {source}")
            continue
        try:
            print(f"[INFO] Scraping: {source} (mock={request.mock})", file=sys.stderr)
            if not request.mock:
                # Anti-bot lassítás éles módban
                delay = random.uniform(SCRAPE_DELAY_MIN, SCRAPE_DELAY_MAX)
                time.sleep(delay)
            caps = fn(geofence, request.limit)
            all_capacities.extend(caps)
        except Exception as e:
            errors.append(f"{source}: {e}")
            print(f"[ERROR] {source} scrape hiba: {e}", file=sys.stderr)

    # Szűrők alkalmazása
    if request.min_pallets > 0:
        all_capacities = [c for c in all_capacities if c.available_pallets >= request.min_pallets]
    if request.vehicle_types:
        allowed = {vt.lower() for vt in request.vehicle_types}
        all_capacities = [c for c in all_capacities if c.vehicle_type in allowed]

    # Geo-szűrés (dupla ellenőrzés) + rendezés távolság szerint
    within = [c for c in all_capacities if geofence.contains(c.origin_lat, c.origin_lng)]
    within.sort(key=lambda c: c.distance_km)
    final = within[: request.limit]

    return FreightScrapeResult(
        capacities=final,
        total_found=len(all_capacities),
        within_geofence=len(within),
        geofence_center=request.center,
        geofence_radius_km=request.radius_km,
        sources_used=request.sources,
        duration_seconds=round(time.time() - start, 3),
        success=len(errors) == 0,
        error_message="; ".join(errors) if errors else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Brunella Geo-fenced Freight Scraper")
    parser.add_argument("--lat", type=float, default=None, help="Közép szélességi fok")
    parser.add_argument("--lng", type=float, default=None, help="Közép hosszúsági fok")
    parser.add_argument("--radius", type=float, default=50.0, help="Sugár km-ben")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--sources", nargs="+", default=["timocom", "trans_eu"])
    parser.add_argument("--mock", action="store_true", help="Mock mód")
    parser.add_argument("--markdown", action="store_true")
    parser.add_argument("--min-pallets", type=int, default=0)
    args = parser.parse_args()

    # Stdin JSON támogatás
    if args.lat is None and not sys.stdin.isatty():
        try:
            data = json.loads(sys.stdin.read())
            req = FreightScrapeRequest(**data)
        except Exception as e:
            print(json.dumps({"error": f"Érvénytelen stdin JSON: {e}"}))
            sys.exit(1)
    elif args.lat is not None:
        req = FreightScrapeRequest(
            center=GeoPoint(lat=args.lat, lng=args.lng or DEFAULT_CENTER_LNG),
            radius_km=args.radius,
            limit=args.limit,
            sources=args.sources,
            mock=args.mock,
            min_pallets=args.min_pallets,
        )
    else:
        # Alapértelmezett: Zalaegerszeg – de a szűrők átjönnek
        req = FreightScrapeRequest(
            mock=args.mock,
            limit=args.limit,
            sources=args.sources,
            min_pallets=args.min_pallets,
        )

    result = scrape_freight(req)

    if args.markdown:
        print(result.to_markdown())
    else:
        print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
