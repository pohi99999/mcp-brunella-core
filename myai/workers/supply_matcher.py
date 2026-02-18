"""
🔗 Supply Chain Matchmaker – FreightCapacity ↔ InternalNeed illesztő motor
Track: hyper_local_supply_chain_20260216 – Phase 2

Glass Box: Geo-szűrt fuvarkapacitásokat párosít belső logisztikai igényekkel.
- Score-alapú döntés (0.0–1.0): raklapszám, jármű-kompatibilitás, dátum sürgetettség, prioritás-súly
- Döntési küszöb: BOOK (≥0.70) | CONSIDER (≥0.40) | SKIP (<0.40)
- Bemenet: geo_scraper.py kimenet (FreightScrapeResult JSON) + data/internal_needs.json
- Kimenet: MatchReport JSON (stdout)

Használat:
    python supply_matcher.py --needs data/internal_needs.json < scraped_capacities.json
    python supply_matcher.py --mock
    python supply_matcher.py --mock --markdown
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Jármű kompatibilitási mátrix
# ─────────────────────────────────────────────────────────────────────────────

VEHICLE_COMPAT: dict[str, dict[str, float]] = {
    "tautliner":    {"tautliner": 1.0, "curtainsider": 0.85, "mega": 0.70, "flatbed": 0.30, "refrigerated": 0.0},
    "curtainsider": {"curtainsider": 1.0, "tautliner": 0.85, "mega": 0.70, "flatbed": 0.30, "refrigerated": 0.0},
    "mega":         {"mega": 1.0, "tautliner": 0.80, "curtainsider": 0.80, "flatbed": 0.40, "refrigerated": 0.0},
    "flatbed":      {"flatbed": 1.0, "mega": 0.50, "tautliner": 0.20, "curtainsider": 0.20, "refrigerated": 0.0},
    "refrigerated": {"refrigerated": 1.0, "tautliner": 0.0, "curtainsider": 0.0, "mega": 0.0, "flatbed": 0.0},
    "box":          {"box": 1.0, "tautliner": 0.50, "curtainsider": 0.50, "mega": 0.40, "flatbed": 0.20},
    "tanker":       {"tanker": 1.0},
    "container":    {"container": 1.0, "flatbed": 0.60},
}

PRIORITY_WEIGHT = {"HIGH": 1.0, "MEDIUM": 0.7, "LOW": 0.4}

BOOK_THRESHOLD = 0.70
CONSIDER_THRESHOLD = 0.40

# ─────────────────────────────────────────────────────────────────────────────
# Modellek
# ─────────────────────────────────────────────────────────────────────────────

class InternalNeed(BaseModel):
    """Belső logisztikai igény (data/internal_needs.json formátum)."""
    id: str
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    type: str
    description: str
    origin: str
    destination: str
    required_pallets: int = Field(ge=1, le=120)
    vehicle_type: str
    latest_date: str            # ISO date string "YYYY-MM-DD"
    weight_kg: float = Field(ge=0)
    value_eur: float = Field(ge=0)
    contact: str
    notes: str = ""

    @field_validator("vehicle_type")
    @classmethod
    def normalize_vehicle(cls, v: str) -> str:
        return v.strip().lower()

    def deadline(self) -> date:
        return date.fromisoformat(self.latest_date)


class FreightCapacity(BaseModel):
    """Geo-scraper által visszaadott fuvarkapacitás (geo_scraper.py kimenet)."""
    id: str = ""
    origin: str
    destination: str
    vehicle_type: str
    available_pallets: int = Field(ge=0, le=33)
    available_date: str         # ISO date string "YYYY-MM-DD"
    contact: str = ""
    source: str = ""
    url: str = ""
    distance_km: float = 0.0
    price_per_km: Optional[float] = None
    currency: str = "EUR"

    @field_validator("vehicle_type")
    @classmethod
    def normalize_vehicle(cls, v: str) -> str:
        return v.strip().lower()

    def avail_date(self) -> date:
        return date.fromisoformat(self.available_date[:10])


class MatchScore(BaseModel):
    """Részletes illesztési pontszám (0.0–1.0)."""
    total: float = Field(ge=0.0, le=1.0)
    pallet_score: float = Field(ge=0.0, le=1.0)
    vehicle_score: float = Field(ge=0.0, le=1.0)
    date_score: float = Field(ge=0.0, le=1.0)
    priority_weight: float = Field(ge=0.0, le=1.0)


class MatchResult(BaseModel):
    """Egy illesztési eredmény."""
    need_id: str
    need_description: str
    capacity_id: str
    capacity_source: str
    capacity_origin: str
    score: MatchScore
    decision: Literal["BOOK", "CONSIDER", "SKIP"]
    reason: str
    available_pallets: int
    required_pallets: int
    available_date: str
    deadline: str
    vehicle_type_need: str
    vehicle_type_capacity: str
    distance_km: float
    contact: str


class MatchReport(BaseModel):
    """Teljes illesztési riport."""
    generated_at: str
    total_needs: int
    total_capacities: int
    matches: list[MatchResult]
    book_count: int
    consider_count: int
    skip_count: int
    best_match: Optional[MatchResult] = None


# ─────────────────────────────────────────────────────────────────────────────
# Scoring logika
# ─────────────────────────────────────────────────────────────────────────────

def score_pallets(available: int, required: int) -> float:
    """Raklapszám fedezettség score."""
    if available >= required:
        return 1.0
    ratio = available / max(required, 1)
    if ratio >= 0.8:
        return 0.70
    if ratio >= 0.6:
        return 0.45
    return 0.20


def score_vehicle(capacity_type: str, need_type: str) -> float:
    """Jármű típus kompatibilitás score."""
    cap_norm = capacity_type.lower()
    need_norm = need_type.lower()
    if cap_norm == need_norm:
        return 1.0
    compat_row = VEHICLE_COMPAT.get(cap_norm, {})
    return compat_row.get(need_norm, 0.1)


def score_date(available: date, deadline: date) -> float:
    """Dátum sürgetettség score – mennyire illik a kapacitás dátuma az igény határidejébe."""
    today = date.today()
    days_diff = (deadline - available).days  # pozitív: boundary előtt van

    if available > deadline:
        late_days = (available - deadline).days
        if late_days <= 1:
            return 0.25  # egy napot késik – figyelembe vehető
        return 0.0  # késő

    # available <= deadline (jó irány)
    if days_diff <= 3:
        return 1.0   # 0-3 nappal korábban – ideális
    if days_diff <= 7:
        return 0.80
    if days_diff <= 14:
        return 0.55
    return 0.30  # nagyon korán van – pazarlás


def score_match(cap: FreightCapacity, need: InternalNeed) -> MatchScore:
    """Teljes score kiszámítása egy kapacitás-igény párra."""
    p = score_pallets(cap.available_pallets, need.required_pallets)
    v = score_vehicle(cap.vehicle_type, need.vehicle_type)
    d = score_date(cap.avail_date(), need.deadline())
    w = PRIORITY_WEIGHT.get(need.priority, 0.7)

    # Súlyozás: raklapszám 35%, jármű-kompatibilitás 30%, dátum 25%, prioritás 10%
    raw = p * 0.35 + v * 0.30 + d * 0.25
    total = min(raw * (0.9 + w * 0.1), 1.0)  # prioritás enyhe bónusz

    return MatchScore(
        total=round(total, 4),
        pallet_score=round(p, 4),
        vehicle_score=round(v, 4),
        date_score=round(d, 4),
        priority_weight=round(w, 4),
    )


def decide(score: float) -> Literal["BOOK", "CONSIDER", "SKIP"]:
    if score >= BOOK_THRESHOLD:
        return "BOOK"
    if score >= CONSIDER_THRESHOLD:
        return "CONSIDER"
    return "SKIP"


def build_reason(score: MatchScore, cap: FreightCapacity, need: InternalNeed) -> str:
    parts: list[str] = []

    # Raklapszám
    if cap.available_pallets >= need.required_pallets:
        parts.append(f"[OK] Raklapszám OK ({cap.available_pallets}/{need.required_pallets})")
    else:
        parts.append(f"[WARN] Részleges kapacitás ({cap.available_pallets}/{need.required_pallets} raklap)")

    # Jármű
    if score.vehicle_score >= 0.9:
        parts.append(f"[OK] Jármű egyezés ({cap.vehicle_type})")
    elif score.vehicle_score >= 0.5:
        parts.append(f"[MODERATE] Hasonló jármű ({cap.vehicle_type} <-> {need.vehicle_type})")
    else:
        parts.append(f"[FAIL] Jármű eltérés ({cap.vehicle_type} <-> {need.vehicle_type})")

    # Dátum
    avail = cap.avail_date()
    dl = need.deadline()
    days_diff = (dl - avail).days
    if days_diff >= 0:
        parts.append(f"[OK] Dátum OK ({avail} -> határidő: {dl})")
    else:
        parts.append(f"[FAIL] Késő ({avail} > határidő: {dl})")

    # Geo
    if cap.distance_km > 0:
        parts.append(f"[GEO] {cap.distance_km:.1f} km a bázistól")

    return " | ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Fő illesztő motor
# ─────────────────────────────────────────────────────────────────────────────

def match_all(capacities: list[FreightCapacity], needs: list[InternalNeed]) -> MatchReport:
    """Minden kapacitás-igény kombinációt kiértékel, BOOK/CONSIDER/SKIP döntéssel."""
    results: list[MatchResult] = []

    for need in needs:
        for cap in capacities:
            score = score_match(cap, need)
            decision = decide(score.total)
            reason = build_reason(score, cap, need)

            results.append(MatchResult(
                need_id=need.id,
                need_description=need.description,
                capacity_id=cap.id or f"{cap.source}_{cap.origin[:6]}",
                capacity_source=cap.source,
                capacity_origin=cap.origin,
                score=score,
                decision=decision,
                reason=reason,
                available_pallets=cap.available_pallets,
                required_pallets=need.required_pallets,
                available_date=str(cap.avail_date()),
                deadline=str(need.deadline()),
                vehicle_type_need=need.vehicle_type,
                vehicle_type_capacity=cap.vehicle_type,
                distance_km=cap.distance_km,
                contact=cap.contact,
            ))

    # Rendezés: total score csökkenő sorrendben
    results.sort(key=lambda r: r.score.total, reverse=True)

    book = [r for r in results if r.decision == "BOOK"]
    consider = [r for r in results if r.decision == "CONSIDER"]
    skip = [r for r in results if r.decision == "SKIP"]

    return MatchReport(
        generated_at=datetime.now().isoformat(),
        total_needs=len(needs),
        total_capacities=len(capacities),
        matches=results,
        book_count=len(book),
        consider_count=len(consider),
        skip_count=len(skip),
        best_match=results[0] if results else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Mock adatok
# ─────────────────────────────────────────────────────────────────────────────

MOCK_CAPACITIES: list[FreightCapacity] = [
    FreightCapacity(
        id="mock-001", origin="Zalaegerszeg, HU", destination="Graz, AT",
        vehicle_type="tautliner", available_pallets=8, available_date="2026-02-19",
        contact="ABC Trans Kft.", source="timocom", distance_km=12.5,
    ),
    FreightCapacity(
        id="mock-002", origin="Körmend, HU", destination="München, DE",
        vehicle_type="mega", available_pallets=12, available_date="2026-02-21",
        contact="EuroFreight GmbH", source="trans_eu", distance_km=28.3,
    ),
    FreightCapacity(
        id="mock-003", origin="Keszthely, HU", destination="Bratislava, SK",
        vehicle_type="tautliner", available_pallets=6, available_date="2026-02-18",
        contact="Gyors Fuvar Bt.", source="timocom", distance_km=35.1,
    ),
    FreightCapacity(
        id="mock-004", origin="Wien, AT", destination="Zalaegerszeg, HU",
        vehicle_type="flatbed", available_pallets=20, available_date="2026-02-24",
        contact="Stahl-Trans GmbH", source="trans_eu", distance_km=45.8, price_per_km=1.85,
    ),
    FreightCapacity(
        id="mock-005", origin="Nagykanizsa, HU", destination="Ljubljana, SI",
        vehicle_type="curtainsider", available_pallets=4, available_date="2026-03-03",
        contact="Adria Logistics", source="timocom", distance_km=22.0,
    ),
]

MOCK_NEEDS_JSON = {
    "internal_needs": [
        {
            "id": "IN-001", "priority": "HIGH", "type": "outbound_freight",
            "description": "Prototípus alkatrészek Graz-ba – sürgős",
            "origin": "Zalaegerszeg, HU", "destination": "Graz, AT",
            "required_pallets": 6, "vehicle_type": "tautliner",
            "latest_date": "2026-02-20", "weight_kg": 1200,
            "value_eur": 25000, "contact": "logistics@brunella.ai", "notes": "",
        },
        {
            "id": "IN-004", "priority": "HIGH", "type": "outbound_freight",
            "description": "Ipari berendezés transzport Münchenbe",
            "origin": "Körmend, HU", "destination": "München, DE",
            "required_pallets": 12, "vehicle_type": "mega",
            "latest_date": "2026-02-22", "weight_kg": 5200,
            "value_eur": 45000, "contact": "logistics@brunella.ai", "notes": "",
        },
    ]
}


# ─────────────────────────────────────────────────────────────────────────────
# Markdown kimenet
# ─────────────────────────────────────────────────────────────────────────────

def to_markdown(report: MatchReport) -> str:
    lines = [
        "# [MATCH] Supply Chain Match Report",
        f"**Generálva:** {report.generated_at}",
        f"**Igények:** {report.total_needs} | **Kapacitások:** {report.total_capacities}",
        f"**[BOOK]:** {report.book_count} | **[CONSIDER]:** {report.consider_count} | **[SKIP]:** {report.skip_count}",
        "",
    ]

    book = [r for r in report.matches if r.decision == "BOOK"]
    consider = [r for r in report.matches if r.decision == "CONSIDER"]

    if book:
        lines.append("## [BOOK] Azonnali foglalás (BOOK)")
        for r in book[:5]:
            lines.append(
                f"- **{r.need_id}** <-> `{r.capacity_id}` | "
                f"Score: **{r.score.total:.2f}** | {r.available_pallets}/{r.required_pallets} raklap | "
                f"{r.vehicle_type_capacity} | {r.available_date} -> {r.deadline}"
            )
            lines.append(f"  > {r.reason}")
        lines.append("")

    if consider:
        lines.append("## [CONSIDER] Megfontolásra (CONSIDER)")
        for r in consider[:5]:
            lines.append(
                f"- **{r.need_id}** <-> `{r.capacity_id}` | "
                f"Score: {r.score.total:.2f} | {r.vehicle_type_capacity} | {r.available_date}"
            )
        lines.append("")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def load_needs(path: str) -> list[InternalNeed]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [InternalNeed(**n) for n in data.get("internal_needs", [])]


def load_capacities_from_stdin() -> list[FreightCapacity]:
    raw = sys.stdin.read().strip()
    if not raw:
        return []
    data = json.loads(raw)
    # Geo-scraper kimenet: {"capacities": [...]} vagy direkt lista
    items = data.get("capacities", data) if isinstance(data, dict) else data
    return [FreightCapacity(**c) for c in items]


def main() -> None:
    parser = argparse.ArgumentParser(description="Supply Chain Matchmaker")
    parser.add_argument("--needs", default="data/internal_needs.json",
                        help="Belső igények JSON fájl (default: data/internal_needs.json)")
    parser.add_argument("--mock", action="store_true",
                        help="Mock adatok használata (nem kell stdin)")
    parser.add_argument("--markdown", action="store_true",
                        help="Markdown kimenet (default: JSON)")
    parser.add_argument("--book-only", action="store_true",
                        help="Csak BOOK döntések mutatása")
    parser.add_argument("--min-score", type=float, default=0.0,
                        help="Minimum total score szűrő")
    args = parser.parse_args()

    # Adatok betöltése
    if args.mock:
        capacities = MOCK_CAPACITIES
        needs = [InternalNeed(**n) for n in MOCK_NEEDS_JSON["internal_needs"]]
    else:
        # Stdin: FreightScrapeResult JSON
        capacities = load_capacities_from_stdin()
        if not sys.stdin.isatty() and not capacities:
            print("[ERROR] Nincs stdin adat. Használj --mock-ot teszteléshez.", file=sys.stderr)
            sys.exit(1)

        # Internal needs fájlból
        needs_path = args.needs
        if not os.path.exists(needs_path):
            print(f"[ERROR] Igények fájl nem található: {needs_path}", file=sys.stderr)
            sys.exit(1)
        needs = load_needs(needs_path)

    # Illesztés
    report = match_all(capacities, needs)

    # Szűrés
    if args.book_only:
        report.matches = [r for r in report.matches if r.decision == "BOOK"]
    if args.min_score > 0:
        report.matches = [r for r in report.matches if r.score.total >= args.min_score]

    # Kimenet
    if args.markdown:
        print(to_markdown(report))
    else:
        print(json.dumps(report.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
