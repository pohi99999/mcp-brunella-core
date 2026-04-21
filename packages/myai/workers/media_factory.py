"""
🎨 Media Factory Worker (Draft Mode)
Track: marketing_swarm_20260216 – Phase 3

Glass Box: Ez a worker kampány médiaasseteket generál trendanalízis alapján.
- Draft mód: szöveges placeholderek képek/videók helyett
- Pydantic validáció be/kimeneten
- Mentés: _KNOWLEDGE_BASE/campaigns/<slug>/
- Summary markdown autogenerálás

Használat:
    python media_factory.py --query "AI tools" --trend-file trends.json [--mock]
    echo '{"query": "AI tools", "trends": [...]}' | python media_factory.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Kimeneti Könyvtár
# ─────────────────────────────────────────────────────────────────────────────

CAMPAIGNS_BASE = Path("_KNOWLEDGE_BASE/campaigns")
OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"
COPY_TIMEOUT = 60  # másodperc per asset


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Modellek
# ─────────────────────────────────────────────────────────────────────────────

class TrendItemInput(BaseModel):
    """Trend tétel bemenethez (trend_analyst.py kimenetével kompatibilis)."""
    title: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    source: str = "analysis"
    tags: list[str] = Field(default_factory=list)
    summary: str = ""


class MediaAsset(BaseModel):
    """Egy generált médiaasset."""
    asset_type: str = Field(..., description="Pl. 'headline', 'body_copy', 'cta', 'social_post'")
    platform: str = Field(default="general", description="Pl. 'facebook', 'linkedin', 'email'")
    content: str = Field(..., description="A generált szöveg tartalma")
    is_draft: bool = True
    word_count: int = 0

    @field_validator("content", mode="after")
    @classmethod
    def set_word_count(cls, v: str) -> str:
        return v

    def model_post_init(self, __context: object) -> None:
        self.word_count = len(self.content.split())


class CampaignPackage(BaseModel):
    """Teljes kampánycsomag."""
    campaign_id: str
    query: str
    slug: str
    assets: list[MediaAsset]
    top_trends: list[str]
    summary_path: str = ""
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: float = 0.0
    draft_mode: bool = True
    success: bool = True
    error_message: Optional[str] = None


class MediaFactoryRequest(BaseModel):
    """Media factory kérés."""
    query: str = Field(..., min_length=1)
    trends: list[TrendItemInput] = Field(default_factory=list)
    platforms: list[str] = Field(
        default=["general", "facebook", "linkedin"],
        description="Célplatformok"
    )
    mock: bool = False
    draft_mode: bool = Field(default=True, description="Ha True, AI szöveggenerálás; Ha False, csak placeholder")


# ─────────────────────────────────────────────────────────────────────────────
# Segédfüggvények
# ─────────────────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Szöveg átalakítása URL-barát slug-gá."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text[:50]


def _generate_campaign_id() -> str:
    """Egyedi kampány azonosító."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"camp_{timestamp}"


def _build_copy_prompt(query: str, platform: str, asset_type: str, trends: list[str]) -> str:
    """Copywriting prompt generálás."""
    trend_list = "\n".join(f"- {t}" for t in trends[:5])
    platform_hints = {
        "facebook": "rövid, figyelemfelkeltő, emoji megengedett, max 280 karakter",
        "linkedin": "szakmai hangvétel, adat-vezérelt, max 500 karakter",
        "email": "személyes, tárgysor + bevezető bekezdés, max 800 karakter",
        "general": "semleges, tömör, max 300 karakter",
    }
    hint = platform_hints.get(platform, platform_hints["general"])

    return f"""Írj egy marketing szöveget a következő speccifikáció szerint:

Téma: "{query}"
Platform: {platform} ({hint})
Szöveg típusa: {asset_type}

Aktuális trendek amelyeket figyelembe kell venni:
{trend_list}

Szabályok:
- A szöveg releváns legyen a trendekhez
- Legyen cselekvésre ösztönző (CTA)
- Magyar nyelvű szöveg
- CSAK a szöveget add vissza, semmi mást!"""


def _call_ollama_copy(prompt: str) -> str:
    """Ollama copywriting API hívás."""
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx nem elérhető")

    with httpx.Client(timeout=COPY_TIMEOUT) as client:
        response = client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
            },
        )
        response.raise_for_status()
        return response.json().get("response", "").strip()


PLACEHOLDER_ASSETS = {
    "headline": "🚀 [HEADLINE PLACEHOLDER] – {query} – Innovatív megoldások",
    "body_copy": "📝 [BODY COPY PLACEHOLDER] – Ez a szöveg bemutatja a {query} előnyeit és lehetőségeit. A trendek alapján...",
    "cta": "👉 [CTA PLACEHOLDER] – Kezdje el most!",
    "social_post": "📱 [SOCIAL POST PLACEHOLDER] – {query} | #AI #Innovation #BAS",
}


# ─────────────────────────────────────────────────────────────────────────────
# Asset Generálás
# ─────────────────────────────────────────────────────────────────────────────

ASSET_TYPES = ["headline", "body_copy", "cta", "social_post"]


def _generate_placeholder_asset(asset_type: str, platform: str, query: str) -> MediaAsset:
    """Placeholder asset generálás (draft_mode=False esetén)."""
    template = PLACEHOLDER_ASSETS.get(asset_type, "[PLACEHOLDER] {query}")
    content = template.format(query=query, platform=platform)
    return MediaAsset(
        asset_type=asset_type,
        platform=platform,
        content=content,
        is_draft=True,
    )


def _generate_ai_asset(
    asset_type: str,
    platform: str,
    query: str,
    trends: list[str],
) -> MediaAsset:
    """AI-generált asset Ollama segítségével."""
    prompt = _build_copy_prompt(query, platform, asset_type, trends)
    try:
        content = _call_ollama_copy(prompt)
        if not content:
            raise ValueError("Üres Ollama válasz")
    except Exception as e:
        print(f"[WARN] Ollama asset generálás sikertelen ({e}), placeholder használata", file=sys.stderr)
        return _generate_placeholder_asset(asset_type, platform, query)

    return MediaAsset(
        asset_type=asset_type,
        platform=platform,
        content=content,
        is_draft=False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Kampány Összefoglaló
# ─────────────────────────────────────────────────────────────────────────────

def _generate_summary_markdown(package: CampaignPackage) -> str:
    """Markdown összefoglaló a kampányhoz."""
    lines = [
        f"# 🎯 Kampánycsomag: {package.query}",
        f"",
        f"**Kampány ID:** `{package.campaign_id}`  ",
        f"**Generálva:** {package.generated_at.isoformat()}  ",
        f"**Draft mód:** {'Igen (placeholderek)' if package.draft_mode else 'Nem (AI-generált)'}  ",
        f"**Időtartam:** {package.duration_seconds:.2f}s",
        f"",
        f"## 📈 Felhasznált trendek",
        "",
    ]
    for trend in package.top_trends:
        lines.append(f"- {trend}")
    lines.append("")
    lines.append("## 📦 Generált assetek")
    lines.append("")

    # Platformonkénti csoportosítás
    platforms: dict[str, list[MediaAsset]] = {}
    for asset in package.assets:
        platforms.setdefault(asset.platform, []).append(asset)

    for platform, assets in platforms.items():
        lines.append(f"### {platform.upper()}")
        lines.append("")
        for asset in assets:
            lines.append(f"#### {asset.asset_type}")
            lines.append(f"```")
            lines.append(asset.content)
            lines.append(f"```")
            lines.append(f"_Szócsín: {asset.word_count}_")
            lines.append("")

    lines.append("---")
    lines.append(f"_Brunella Marketing Swarm v2.0 | {package.generated_at.strftime('%Y-%m-%d')}_")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Kampánycsomag Mentése
# ─────────────────────────────────────────────────────────────────────────────

def _save_campaign(package: CampaignPackage, campaign_dir: Path) -> str:
    """Kampánycsomag mentése fájlrendszerre."""
    campaign_dir.mkdir(parents=True, exist_ok=True)

    # 1. JSON (teljes adat)
    json_path = campaign_dir / "campaign.json"
    json_path.write_text(package.model_dump_json(indent=2), encoding="utf-8")

    # 2. Platformonkénti szövegfájlok
    for asset in package.assets:
        safe_type = re.sub(r"[^\w]", "_", asset.asset_type)
        asset_path = campaign_dir / f"{asset.platform}_{safe_type}.txt"
        asset_path.write_text(asset.content, encoding="utf-8")

    # 3. Markdown összefoglaló
    summary_md = _generate_summary_markdown(package)
    summary_path = campaign_dir / "SUMMARY.md"
    summary_path.write_text(summary_md, encoding="utf-8")

    print(f"[INFO] Kampány mentve: {campaign_dir}", file=sys.stderr)
    return str(summary_path)


# ─────────────────────────────────────────────────────────────────────────────
# Fő Gyártási Függvény
# ─────────────────────────────────────────────────────────────────────────────

def produce_campaign(request: MediaFactoryRequest) -> CampaignPackage:
    """
    Kampánycsomag generálása.

    Lépések:
    1. Trend listák előkészítése
    2. Asset generálás minden platformra és típusra
    3. Kampánycsomag összeállítása
    4. Mentés + summary markdown
    """
    start_time = time.time()
    campaign_id = _generate_campaign_id()
    slug = _slugify(request.query)
    campaign_dir = CAMPAIGNS_BASE / slug / campaign_id

    top_trends = [t.title for t in sorted(request.trends, key=lambda x: -x.relevance_score)]

    print(
        f"[INFO] Kampány generálás indul: '{request.query}' "
        f"| Platformok: {request.platforms} | Draft: {request.draft_mode}",
        file=sys.stderr,
    )

    assets: list[MediaAsset] = []

    if request.mock or not request.draft_mode:
        # Placeholder mód (gyors, nincs Ollama hívás)
        for platform in request.platforms:
            for asset_type in ASSET_TYPES:
                assets.append(_generate_placeholder_asset(asset_type, platform, request.query))
    else:
        # AI Draft mód (Ollama hívás asset-enkénti, fallback placeholder)
        for platform in request.platforms:
            for asset_type in ASSET_TYPES:
                print(f"[INFO] Generálás: {platform}/{asset_type}...", file=sys.stderr)
                asset = _generate_ai_asset(asset_type, platform, request.query, top_trends)
                assets.append(asset)

    package = CampaignPackage(
        campaign_id=campaign_id,
        query=request.query,
        slug=slug,
        assets=assets,
        top_trends=top_trends,
        duration_seconds=time.time() - start_time,
        draft_mode=request.draft_mode or request.mock,
    )

    # Mentés
    try:
        summary_path = _save_campaign(package, campaign_dir)
        package.summary_path = summary_path
    except Exception as e:
        print(f"[ERROR] Mentési hiba: {e}", file=sys.stderr)
        package.success = False
        package.error_message = str(e)

    return package


# ─────────────────────────────────────────────────────────────────────────────
# CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Brunella Media Factory Worker")
    parser.add_argument("--query", help="Kampány témája")
    parser.add_argument("--trend-file", help="Trend analyst JSON output fájl")
    parser.add_argument("--platforms", nargs="+", default=["general", "facebook", "linkedin"])
    parser.add_argument("--mock", action="store_true", help="Mock/placeholder mód")
    parser.add_argument("--no-ai", action="store_true", help="Placeholder mód (nincs Ollama hívás)")
    args = parser.parse_args()

    # Stdin-ből is lehet JSON-t küldeni
    if not args.query and not sys.stdin.isatty():
        try:
            raw = sys.stdin.read()
            data = json.loads(raw)
            req = MediaFactoryRequest(**data)
        except Exception as e:
            print(json.dumps({"error": f"Érvénytelen stdin JSON: {e}"}))
            sys.exit(1)
    else:
        if not args.query:
            print(json.dumps({"error": "Add meg a --query argumentumot!"}))
            sys.exit(1)

        # Trend fájl betöltése (opcionális)
        trends: list[TrendItemInput] = []
        if args.trend_file:
            try:
                raw = Path(args.trend_file).read_text(encoding="utf-8")
                trend_data = json.loads(raw)
                trends = [TrendItemInput(**t) for t in trend_data.get("trends", [])]
            except Exception as e:
                print(f"[WARN] Trend fájl betöltési hiba: {e}", file=sys.stderr)

        req = MediaFactoryRequest(
            query=args.query,
            trends=trends,
            platforms=args.platforms,
            mock=args.mock,
            draft_mode=not args.no_ai,
        )

    package = produce_campaign(req)
    print(package.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
