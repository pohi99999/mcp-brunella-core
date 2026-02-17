"""
🏭 Industrial Machine Hunter – Aukciós Scrape Infra
Track: industrial_machine_hunter_20260216 – Phase 1 & 2

Glass Box: Ipari gépek és eszközök aukciós listáinak gyűjtése + értékelése.
- 3 forrás: Machineseeker, Maschinensucher, BidSpotter (mock + live stubs)
- Anti-bot: configurable delay + user-agent rotáció
- EUR normalizáció + leárazási modell (évjárat + üzemóra)
- ValuationResult: BUY / WATCH / IGNORE ajánlás

Használat:
    python machine_hunter.py --query "CNC Germany" [--mock] [--limit 20]
    echo '{"query": "forklift Austria", "mock": true}' | python machine_hunter.py
"""
from __future__ import annotations

import argparse
import json
import math
import random
import re
import sys
import time
import uuid
from datetime import datetime
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

SOURCES = {
    "machineseeker":   "https://www.machineseeker.com",
    "maschinensucher": "https://www.maschinensucher.de",
    "bidspotter":      "https://www.bidspotter.com",
}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/121.0.0.0",
]

# Valuta konverziós táblázat (közelítő, 2026-02 referenciaisok)
EXCHANGE_RATES_TO_EUR: dict[str, float] = {
    "EUR": 1.0,
    "HUF": 0.00252,   # 1 HUF ≈ 0.00252 EUR
    "USD": 0.92,
    "GBP": 1.17,
    "PLN": 0.23,
    "CZK": 0.041,
    "CHF": 1.05,
    "RON": 0.20,
    "SEK": 0.089,
}

# Értékelési paraméterek
BASE_VALUE_MULTIPLIER = 1.0        # 100% alap
ANNUAL_DEPRECIATION_RATE = 0.08   # 8% / év
HOUR_DEPRECIATION_RATE = 0.00003  # 0.003% / üzemóra
MIN_RESIDUAL_VALUE = 0.15          # Minimum 15% marad (roncsérték)

ARBITRAGE_THRESHOLD_BUY = 0.25    # >25% diszkont → BUY
ARBITRAGE_THRESHOLD_WATCH = 0.10  # >10% diszkont → WATCH

SCRAPE_DELAY_MIN = 2.0
SCRAPE_DELAY_MAX = 5.0


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Modellek
# ─────────────────────────────────────────────────────────────────────────────


class MachineListing(BaseModel):
    """Egy ipari gép listázási tétele egy aukciós oldalról."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str = Field(..., description="Gép neve / megnevezés")
    manufacturer: str = Field(default="", description="Gyártó")
    model_no: str = Field(default="", description="Modellszám / típus")
    price: float = Field(..., ge=0.0, description="Ár a forrás valutájában")
    currency: str = Field(default="EUR", description="Forrás valuta")
    year: int = Field(..., ge=1950, le=2030, description="Gyártási év")
    hours: int = Field(default=0, ge=0, description="Üzemórák száma")
    location: str = Field(default="", description="Helyszín (város, ország)")
    category: str = Field(default="industrial", description="Gép kategória")
    condition: Literal["new", "used", "for_parts", "unknown"] = "used"
    source: str = Field(..., description="Adatforrás neve")
    url: str = Field(default="")
    description: str = Field(default="", description="Szabad szöveges leírás")
    scraped_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Cím nem lehet üres")
        return v

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.strip().upper()

    @property
    def price_eur(self) -> float:
        """Ár EUR-ban konvertálva."""
        rate = EXCHANGE_RATES_TO_EUR.get(self.currency, 1.0)
        return round(self.price * rate, 2)

    @property
    def age_years(self) -> int:
        return max(0, datetime.utcnow().year - self.year)


class ValuationResult(BaseModel):
    """Egy MachineListing értékelési eredménye."""
    listing_id: str
    title: str
    price_eur: float = Field(..., description="Vételár EUR-ban")
    estimated_value_eur: float = Field(..., description="Becsült piaci érték EUR-ban")
    arbitrage_score: float = Field(..., ge=0.0, le=1.0, description="0=drága, 1=legjobb vétel")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Értékelés megbízhatósága")
    recommendation: Literal["BUY", "WATCH", "IGNORE"] = "IGNORE"
    reasoning: str = Field(default="", description="Miért ez az ajánlás")
    discount_pct: float = Field(default=0.0, description="Diszkont %-ban (negatív = drágább)")
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class MachineHuntRequest(BaseModel):
    """Vadászati kérés – mit keressünk, hol."""
    query: str = Field(..., min_length=1, description="Keresési kifejezés (pl. 'CNC Germany')")
    sources: list[str] = Field(
        default=["machineseeker", "maschinensucher", "bidspotter"],
        description="Aktív adatforrások",
    )
    limit: int = Field(default=20, ge=1, le=200)
    mock: bool = False
    currency_base: str = Field(default="EUR", description="Normalizációs valuta")
    min_year: Optional[int] = Field(default=None, ge=1950)
    max_hours: Optional[int] = Field(default=None, ge=0)
    max_price_eur: Optional[float] = Field(default=None, ge=0.0)
    categories: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_sources(self) -> "MachineHuntRequest":
        valid = set(SOURCES.keys())
        for s in self.sources:
            if s not in valid:
                raise ValueError(f"Ismeretlen forrás: '{s}'. Érvényes: {valid}")
        return self

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Keresési kifejezés nem lehet üres")
        return v


class MachineHuntResult(BaseModel):
    """Teljes vadászati eredmény: listázások + értékelések."""
    query: str
    listings: list[MachineListing]
    valuations: list[ValuationResult]
    top_buys: list[ValuationResult]        # BUY ajánlású tételek
    total_scraped: int
    after_filters: int
    sources_used: list[str]
    duration_seconds: float = 0.0
    success: bool = True
    error_message: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_markdown(self) -> str:
        lines = [
            f"# 🏭 Industrial Machine Hunter – Eredmények",
            f"",
            f"**Keresés:** `{self.query}`  ",
            f"**Talált:** {self.total_scraped} | **Szűrés után:** {self.after_filters}  ",
            f"**BUY ajánlás:** {len(self.top_buys)}  ",
            f"**Időtartam:** {self.duration_seconds:.2f}s",
            "",
        ]
        if self.top_buys:
            lines.append("## 🟢 BUY Ajánlások")
            for v in self.top_buys:
                lines.append(f"- **{v.title}** – {v.price_eur:.0f} EUR "
                             f"(becsült: {v.estimated_value_eur:.0f} EUR, "
                             f"diszkont: {v.discount_pct:.1f}%)")
        lines.append("")
        lines.append("## 📋 Összes Értékelt Gép")
        for v in self.valuations:
            icon = {"BUY": "🟢", "WATCH": "🟡", "IGNORE": "🔴"}.get(v.recommendation, "⚪")
            lines.append(f"- {icon} `{v.recommendation}` **{v.title}** – "
                        f"{v.price_eur:.0f} EUR | score: {v.arbitrage_score:.2f}")
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Értékelési Motor
# ─────────────────────────────────────────────────────────────────────────────

def convert_to_eur(price: float, currency: str) -> float:
    """Ár EUR-ra konvertálása a belső árfolyamtáblázat alapján."""
    rate = EXCHANGE_RATES_TO_EUR.get(currency.upper(), 1.0)
    return round(price * rate, 2)


def estimate_machine_value(listing: MachineListing) -> float:
    """
    Leárazáson alapuló piaci értékbecslés.

    Modell:
        érték = ár * (1 - éves_leírás * kor) * (1 - óra_leírás * üzemórák)
        minimum: eredeti_ár * MIN_RESIDUAL_VALUE

    Megjegyzés: A „valós" piaci értéket egy képzett adatbázis (pl. LanceDB
    historikus auction adatok) finomíthatja. Ebben a PoC verzióban az aktuális
    árat visszük mint referenciaértékhez – a diszkont a saját felvételéhez képest.
    """
    age = listing.age_years
    hours = max(0, listing.hours)

    # Tiszta értékrész: kor + üzemóra alapján csökkentett
    age_factor = max(
        MIN_RESIDUAL_VALUE,
        1.0 - ANNUAL_DEPRECIATION_RATE * age,
    )
    hour_factor = max(
        MIN_RESIDUAL_VALUE,
        1.0 - HOUR_DEPRECIATION_RATE * hours,
    )
    combined_factor = (age_factor + hour_factor) / 2

    # A „becsült piaci érték" a jelenleg listázott ár inverse-discounted verziója
    # (azaz: ha 5 éves, 2000 órás, akkor a catalog ár × factor ≈ fair value)
    # Valós implementációban RAG keresési historikus aukciós árakból kalkulálandó
    catalog_reference = listing.price_eur / combined_factor if combined_factor > 0 else listing.price_eur
    estimated = catalog_reference * combined_factor
    return round(max(estimated, listing.price_eur * MIN_RESIDUAL_VALUE), 2)


def calc_arbitrage_score(price_eur: float, estimated_eur: float) -> tuple[float, float]:
    """
    Arbitrázs pontszám és diszkont %-számítás.

    Returns: (arbitrage_score 0-1, discount_pct)
        - discount_pct pozitív → gép az értéke alatt van → "jó vétel"
        - discount_pct negatív → drágább a valós értéknél
    """
    if estimated_eur <= 0:
        return 0.0, 0.0

    discount_pct = round((estimated_eur - price_eur) / estimated_eur * 100, 2)
    # Normalized: max 50% diszkont = 1.0 score
    normalized = max(0.0, min(1.0, discount_pct / 50.0))
    return round(normalized, 4), discount_pct


def determine_recommendation(
    arbitrage_score: float,
    confidence: float,
    listing: MachineListing,
) -> tuple[Literal["BUY", "WATCH", "IGNORE"], str]:
    """BUY / WATCH / IGNORE döntés + szöveges indoklás."""
    # Alkatrész-only kiszűrés
    lowered = (listing.title + " " + listing.description).lower()
    for noise_word in ("parts only", "for parts", "defective", "nicht fahrbereit", "ersatzteile"):
        if noise_word in lowered:
            return "IGNORE", f"Alkatrész/hibás tétel szűrve: '{noise_word}'"

    if listing.condition == "for_parts":
        return "IGNORE", "for_parts állapot"

    if arbitrage_score >= ARBITRAGE_THRESHOLD_BUY and confidence >= 0.5:
        return "BUY", (
            f"Árszint az becsült érték alatt {arbitrage_score*100:.0f}%-kal. "
            f"Megbízhatóság: {confidence:.2f}."
        )
    if arbitrage_score >= ARBITRAGE_THRESHOLD_WATCH or confidence >= 0.7:
        return "WATCH", (
            f"Közepes arbitrázs ({arbitrage_score*100:.0f}%) vagy magas "
            f"megbízhatóság ({confidence:.2f}). Követésre érdemes."
        )
    return "IGNORE", f"Alacsony vonzerő (score={arbitrage_score:.2f}, conf={confidence:.2f})"


def valuate_listing(listing: MachineListing) -> ValuationResult:
    """Egy listát teljes értékeléssé alakít."""
    price_eur = listing.price_eur
    estimated = estimate_machine_value(listing)

    # Megbízhatóság: magas ha sok adatunk van (év + üzemóra ismert)
    confidence_parts = [
        0.4,                         # alap
        0.3 if listing.year > 1980 else 0.1,
        0.2 if listing.hours > 0 else 0.0,
        0.1 if listing.manufacturer else 0.0,
    ]
    confidence = round(min(1.0, sum(confidence_parts)), 3)

    score, discount_pct = calc_arbitrage_score(price_eur, estimated)
    recommendation, reasoning = determine_recommendation(score, confidence, listing)

    return ValuationResult(
        listing_id=listing.id,
        title=listing.title,
        price_eur=price_eur,
        estimated_value_eur=estimated,
        arbitrage_score=score,
        confidence=confidence,
        recommendation=recommendation,
        reasoning=reasoning,
        discount_pct=discount_pct,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Mock Adatok
# ─────────────────────────────────────────────────────────────────────────────

_MOCK_LISTINGS_POOL = [
    # CNC / megmunkálás
    {
        "title": "DMG MORI CMX 600 V CNC Megmunkáló Centrum",
        "manufacturer": "DMG MORI", "model_no": "CMX 600 V",
        "price": 38500, "currency": "EUR", "year": 2018, "hours": 4200,
        "location": "München, DE", "category": "cnc_milling",
        "condition": "used",
    },
    {
        "title": "HAAS VF-2 CNC Marógép",
        "manufacturer": "HAAS", "model_no": "VF-2",
        "price": 22000, "currency": "EUR", "year": 2015, "hours": 8900,
        "location": "Stuttgart, DE", "category": "cnc_milling",
        "condition": "used",
    },
    {
        "title": "TRUMPF TruLaser 3030 Lézervágó",
        "manufacturer": "TRUMPF", "model_no": "TruLaser 3030",
        "price": 95000, "currency": "EUR", "year": 2020, "hours": 1800,
        "location": "Ditzingen, DE", "category": "laser_cutting",
        "condition": "used",
    },
    # Targoncák
    {
        "title": "Toyota 8FBN25 Elektromos Targonca 2.5T",
        "manufacturer": "Toyota", "model_no": "8FBN25",
        "price": 12500, "currency": "EUR", "year": 2019, "hours": 3100,
        "location": "Bécs, AT", "category": "forklift",
        "condition": "used",
    },
    {
        "title": "Linde E35 Elektromos Targonca – Alkatrész",
        "manufacturer": "Linde", "model_no": "E35",
        "price": 3200, "currency": "EUR", "year": 2010, "hours": 22000,
        "location": "Graz, AT", "category": "forklift",
        "condition": "for_parts",
    },
    # Kompresszorok / energia
    {
        "title": "Atlas Copco GA 75 VSD Csavarkompresszor",
        "manufacturer": "Atlas Copco", "model_no": "GA 75 VSD",
        "price": 8900, "currency": "EUR", "year": 2017, "hours": 12000,
        "location": "Antwerp, BE", "category": "compressor",
        "condition": "used",
    },
    {
        "title": "Caterpillar 320D Hidraulikus Kotrógép",
        "manufacturer": "Caterpillar", "model_no": "320D",
        "price": 67000, "currency": "USD", "year": 2016, "hours": 7400,
        "location": "London, GB", "category": "excavator",
        "condition": "used",
    },
    # Nyomda
    {
        "title": "Heidelberg Speedmaster XL 106 Ívnyomda",
        "manufacturer": "Heidelberg", "model_no": "Speedmaster XL 106",
        "price": 320000, "currency": "EUR", "year": 2019, "hours": 9500,
        "location": "Heidelberg, DE", "category": "printing",
        "condition": "used",
    },
    # Aukciós tétel (alulértékelt)
    {
        "title": "Mazak Integrex i-200 Esztergáló-Maró Centrum",
        "manufacturer": "Mazak", "model_no": "Integrex i-200",
        "price": 28000, "currency": "EUR", "year": 2017, "hours": 5500,
        "location": "Praha, CZ", "category": "cnc_lathe",
        "condition": "used",
    },
    {
        "title": "Kuka KR 120 R2500 Robotkar",
        "manufacturer": "Kuka", "model_no": "KR 120 R2500",
        "price": 15000, "currency": "EUR", "year": 2016, "hours": 18000,
        "location": "Augsburg, DE", "category": "robot",
        "condition": "used",
    },
    {
        "title": "Liebherr LTM 1050-3.1 Autódaru 50T",
        "manufacturer": "Liebherr", "model_no": "LTM 1050-3.1",
        "price": 280000, "currency": "EUR", "year": 2014, "hours": 14000,
        "location": "Hamburg, DE", "category": "crane",
        "condition": "used",
    },
    {
        "title": "Fanuc Robodrill D21MiB5 CNC Megmunkáló",
        "manufacturer": "Fanuc", "model_no": "D21MiB5",
        "price": 18500, "currency": "EUR", "year": 2020, "hours": 2200,
        "location": "Miskolc, HU", "category": "cnc_milling",
        "condition": "used",
    },
]


def _make_listing(raw: dict, source: str, idx: int) -> MachineListing:
    return MachineListing(
        id=f"{source}_{idx:04d}",
        source=source,
        url=f"{SOURCES.get(source, '')}/listings/{idx}",
        **{k: v for k, v in raw.items()},
    )


def _scrape_machineseeker_mock(query: str, limit: int) -> list[MachineListing]:
    pool = _MOCK_LISTINGS_POOL[:8]  # Machineseeker-specifikus részlet
    return [_make_listing(r, "machineseeker", i) for i, r in enumerate(pool[:limit])]


def _scrape_maschinensucher_mock(query: str, limit: int) -> list[MachineListing]:
    pool = _MOCK_LISTINGS_POOL[2:10]  # Átfedés szándékos – dupla listing szűréshez
    return [_make_listing(r, "maschinensucher", i + 100) for i, r in enumerate(pool[:limit])]


def _scrape_bidspotter_mock(query: str, limit: int) -> list[MachineListing]:
    pool = _MOCK_LISTINGS_POOL[6:]  # Aukciós pool – jellemzően alulértékeltek
    return [_make_listing(r, "bidspotter", i + 200) for i, r in enumerate(pool[:limit])]


# ─────────────────────────────────────────────────────────────────────────────
# Live Scrape Stubs
# ─────────────────────────────────────────────────────────────────────────────

def _scrape_machineseeker_live(query: str, limit: int) -> list[MachineListing]:
    """
    🔴 LIVE – Machineseeker.com scrape stub.

    TODO integráció:
    1. GET https://www.machineseeker.com/search?q={query}&lang=en
    2. BeautifulSoup / playwright: listing kártyák kinyerése
    3. Pagináció kezelése (max limit tétel)
    4. MachineListing konverzió + validáció

    Jelenleg mock fallback.
    """
    print("[INFO] Machineseeker live scrape stub – mock fallback", file=sys.stderr)
    return _scrape_machineseeker_mock(query, limit)


def _scrape_maschinensucher_live(query: str, limit: int) -> list[MachineListing]:
    """
    🔴 LIVE – Maschinensucher.de scrape stub.

    TODO integráció:
    1. Kereső form POST: https://www.maschinensucher.de/suche/?q={query}
    2. JSON API endpoint keresés: /api/listings?q={query}
    3. Valuta: HUF/EUR mix – konverzió szükséges

    Jelenleg mock fallback.
    """
    print("[INFO] Maschinensucher live scrape stub – mock fallback", file=sys.stderr)
    return _scrape_maschinensucher_mock(query, limit)


def _scrape_bidspotter_live(query: str, limit: int) -> list[MachineListing]:
    """
    🔴 LIVE – BidSpotter.com scrape stub (aukciós oldal).

    TODO integráció:
    1. GET https://www.bidspotter.com/en-us/search?q={query}
    2. Aukció dátum + zárási idő figyelése
    3. Proxy rotáció ajánlott (CloudFlare védett oldal)
    4. bid_start / buy_now ár megkülönböztetés

    Jelenleg mock fallback.
    """
    print("[INFO] BidSpotter live scrape stub – mock fallback", file=sys.stderr)
    return _scrape_bidspotter_mock(query, limit)


# ─────────────────────────────────────────────────────────────────────────────
# Fő Vadászati Függvény
# ─────────────────────────────────────────────────────────────────────────────

def hunt_machines(request: MachineHuntRequest) -> MachineHuntResult:
    """
    Ipari gép vadászat fő belépési pont.

    1. Multi-source scraping (mock vagy live stub)
    2. Szűrők alkalmazása (év, óra, ár, kategória)
    3. EUR normalizáció + értékelés minden tételre
    4. Eredmény összeállítás (BUY/WATCH/IGNORE szegmentálás)
    """
    start = time.time()

    scraper_map = {
        "machineseeker":   _scrape_machineseeker_mock if request.mock else _scrape_machineseeker_live,
        "maschinensucher": _scrape_maschinensucher_mock if request.mock else _scrape_maschinensucher_live,
        "bidspotter":      _scrape_bidspotter_mock if request.mock else _scrape_bidspotter_live,
    }

    all_listings: list[MachineListing] = []
    errors: list[str] = []

    for source in request.sources:
        fn = scraper_map.get(source)
        if fn is None:
            errors.append(f"Ismeretlen forrás: {source}")
            continue
        try:
            print(f"[INFO] Hunting: {source} | query='{request.query}' (mock={request.mock})", file=sys.stderr)
            if not request.mock:
                delay = random.uniform(SCRAPE_DELAY_MIN, SCRAPE_DELAY_MAX)
                ua = random.choice(USER_AGENTS)
                print(f"[INFO] Anti-bot: {delay:.1f}s delay, UA={ua[:40]}...", file=sys.stderr)
                time.sleep(delay)
            listings = fn(request.query, request.limit)
            all_listings.extend(listings)
        except Exception as e:
            errors.append(f"{source}: {e}")
            print(f"[ERROR] {source} hiba: {e}", file=sys.stderr)

    total_scraped = len(all_listings)

    # ── Szűrők ──────────────────────────────────────────────────────────────
    filtered = all_listings
    if request.min_year:
        filtered = [l for l in filtered if l.year >= request.min_year]
    if request.max_hours is not None:
        filtered = [l for l in filtered if l.hours <= request.max_hours]
    if request.max_price_eur is not None:
        filtered = [l for l in filtered if l.price_eur <= request.max_price_eur]
    if request.categories:
        allowed = {c.lower() for c in request.categories}
        filtered = [l for l in filtered if l.category.lower() in allowed]

    # Feltétel-only kiszűrés (zajszűrés)
    filtered = [l for l in filtered if l.condition != "for_parts"]
    filtered = filtered[: request.limit]

    # ── Értékelés ────────────────────────────────────────────────────────────
    valuations = [valuate_listing(l) for l in filtered]
    top_buys = [v for v in valuations if v.recommendation == "BUY"]
    # BUY-ok arbitrázs score szerint csökkenő sorrendben
    top_buys.sort(key=lambda v: -v.arbitrage_score)

    if top_buys:
        print(f"[INFO] 🟢 {len(top_buys)} BUY ajánlás:", file=sys.stderr)
        for v in top_buys:
            print(f"  • {v.title} – {v.price_eur:.0f} EUR (score={v.arbitrage_score:.2f})", file=sys.stderr)

    return MachineHuntResult(
        query=request.query,
        listings=filtered,
        valuations=valuations,
        top_buys=top_buys,
        total_scraped=total_scraped,
        after_filters=len(filtered),
        sources_used=request.sources,
        duration_seconds=round(time.time() - start, 3),
        success=len(errors) == 0,
        error_message="; ".join(errors) if errors else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Brunella Industrial Machine Hunter")
    parser.add_argument("--query", help="Keresési kifejezés")
    parser.add_argument("--sources", nargs="+", default=["machineseeker", "maschinensucher", "bidspotter"])
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--min-year", type=int, default=None)
    parser.add_argument("--max-hours", type=int, default=None)
    parser.add_argument("--max-price", type=float, default=None)
    parser.add_argument("--markdown", action="store_true")
    args = parser.parse_args()

    # Stdin JSON
    if not args.query and not sys.stdin.isatty():
        try:
            data = json.loads(sys.stdin.read())
            req = MachineHuntRequest(**data)
        except Exception as e:
            print(json.dumps({"error": f"Érvénytelen stdin JSON: {e}"}))
            sys.exit(1)
    elif args.query:
        req = MachineHuntRequest(
            query=args.query,
            sources=args.sources,
            limit=args.limit,
            mock=args.mock,
            min_year=args.min_year,
            max_hours=args.max_hours,
            max_price_eur=args.max_price,
        )
    else:
        print(json.dumps({"error": "Add meg a --query argumentumot!"}))
        sys.exit(1)

    result = hunt_machines(req)

    if args.markdown:
        print(result.to_markdown())
    else:
        print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
