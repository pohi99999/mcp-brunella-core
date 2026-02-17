"""
🔍 Trend Analyst Worker
Track: marketing_swarm_20260216 – Phase 2

Glass Box: Ez a worker AI-vezérelt trendanalízist végez egy termékkategóriára.
- Pydantic validáció minden be/kimeneten
- 3 perces (180 mp) timeout védelem
- Retry logika exponenciális visszalépéssel
- Fallback statikus trendek ha az API nem elérhető

Használat:
    python trend_analyst.py <query> [--limit N] [--mock]
    echo '{"query": "AI tools"}' | python trend_analyst.py
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from typing import Optional

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Modellek
# ─────────────────────────────────────────────────────────────────────────────

class TrendItem(BaseModel):
    """Egy trend tétel."""
    title: str = Field(..., description="A trend rövid megnevezése")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Releváns pontszám 0-1 között")
    source: str = Field(default="analysis", description="Adat forrása")
    tags: list[str] = Field(default_factory=list, description="Kapcsolódó kulcsszavak")
    summary: str = Field(default="", description="Rövid összefoglaló")

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A trend cím nem lehet üres")
        return v.strip()


class TrendAnalysisRequest(BaseModel):
    """Trendanalízis kérés."""
    query: str = Field(..., min_length=1, description="Keresési lekérdezés")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum trendek száma")
    mock: bool = Field(default=False, description="Mock mód (teszt adatok)")


class TrendAnalysisReport(BaseModel):
    """Teljes trendanalízis riport."""
    query: str
    trends: list[TrendItem]
    total_found: int
    analysis_engine: str = Field(default="ollama", description="Elemzési motor neve")
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: float = Field(default=0.0)
    success: bool = True
    error_message: Optional[str] = None

    def to_markdown(self) -> str:
        """Markdown összefoglaló generálás."""
        lines = [
            f"# 🔍 Trendanalízis: {self.query}",
            f"",
            f"**Generálva:** {self.generated_at.isoformat()}  ",
            f"**Motor:** {self.analysis_engine}  ",
            f"**Időtartam:** {self.duration_seconds:.2f}s  ",
            f"**Trendek száma:** {self.total_found}",
            "",
            "## 📊 Trendek",
            "",
        ]
        for i, trend in enumerate(self.trends, 1):
            lines.append(f"### {i}. {trend.title}")
            lines.append(f"- **Relevancia:** {trend.relevance_score:.2f}")
            lines.append(f"- **Forrás:** {trend.source}")
            if trend.tags:
                lines.append(f"- **Tagek:** {', '.join(trend.tags)}")
            if trend.summary:
                lines.append(f"- **Összefoglaló:** {trend.summary}")
            lines.append("")
        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Fallback (Mock) Trendek
# ─────────────────────────────────────────────────────────────────────────────

FALLBACK_TRENDS = [
    TrendItem(
        title="AI-vezérelt automatizálás",
        relevance_score=0.95,
        source="fallback",
        tags=["AI", "automáció", "üzleti folyamatok"],
        summary="Növekvő igény az AI-alapú folyamatautomatizálás iránt",
    ),
    TrendItem(
        title="Multi-agent rendszerek",
        relevance_score=0.92,
        source="fallback",
        tags=["multi-agent", "orchestration", "LLM"],
        summary="Komplex feladatokhoz több AI ügynök együttműködése",
    ),
    TrendItem(
        title="Edge computing + AI",
        relevance_score=0.88,
        source="fallback",
        tags=["edge", "Cloudflare", "Workers"],
        summary="AI modellek futtatása peremhálózaton",
    ),
    TrendItem(
        title="RAG (Retrieval-Augmented Generation)",
        relevance_score=0.85,
        source="fallback",
        tags=["RAG", "vektoros keresés", "LanceDB"],
        summary="Vállalati tudásbázis + LLM kombináció",
    ),
    TrendItem(
        title="Low-code AI fejlesztés",
        relevance_score=0.80,
        source="fallback",
        tags=["low-code", "no-code", "citizen-developer"],
        summary="Nem programozók is építhetnek AI alkalmazásokat",
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Ollama-alapú Trendanalízis
# ─────────────────────────────────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:3b"
TREND_TIMEOUT = 180  # 3 perc
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # exponenciális visszalépés alapja (mp)


def _build_prompt(query: str, limit: int) -> str:
    return f"""Elemezd a következő témához kapcsolódó aktuális trendeket: "{query}"

Adj vissza pontosan {limit} trendet JSON formátumban:
{{
  "trends": [
    {{
      "title": "Trend neve",
      "relevance_score": 0.95,
      "source": "ollama_analysis",
      "tags": ["tag1", "tag2"],
      "summary": "Rövid leírás"
    }}
  ]
}}

Fontos szabályok:
- A `relevance_score` 0.0 és 1.0 között legyen
- A `title` legyen rövid és tömör (max 50 karakter)
- A `tags` lista 2-5 elemet tartalmazzon
- A `summary` max 100 karakter legyen
- Válasz CSAK JSON legyen, semmi más!"""


def _parse_ollama_response(raw: str, query: str) -> list[TrendItem]:
    """Ollama válasz JSON parse és Pydantic validáció."""
    # Keressük meg a JSON blokkot
    import re
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        raise ValueError(f"Nem található JSON a válaszban: {raw[:200]}")

    data = json.loads(json_match.group())
    raw_trends = data.get("trends", [])

    validated = []
    for item in raw_trends:
        try:
            validated.append(TrendItem(**item))
        except Exception as e:
            print(f"[WARN] Érvénytelen trend kihagyva: {e}", file=sys.stderr)
    return validated


def _call_ollama_with_retry(query: str, limit: int) -> list[TrendItem]:
    """Ollama API hívás retry logikával."""
    if not HTTPX_AVAILABLE:
        raise RuntimeError("httpx csomag nem elérhető – telepítsd: pip install httpx")

    prompt = _build_prompt(query, limit)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[INFO] Ollama hívás (attempt {attempt}/{MAX_RETRIES})...", file=sys.stderr)
            with httpx.Client(timeout=TREND_TIMEOUT) as client:
                response = client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                    },
                )
                response.raise_for_status()
                data = response.json()
                raw_text = data.get("response", "")
                trends = _parse_ollama_response(raw_text, query)
                if trends:
                    return trends
                raise ValueError("Üres trendlista az Ollama válaszból")

        except (httpx.ConnectError, httpx.TimeoutException) as e:
            delay = RETRY_BASE_DELAY ** attempt
            print(f"[WARN] Ollama nem érhető el: {e}. Újrapróbálás {delay}s múlva...", file=sys.stderr)
            if attempt < MAX_RETRIES:
                time.sleep(delay)
        except Exception as e:
            print(f"[ERROR] Ollama hiba: {e}", file=sys.stderr)
            raise

    raise RuntimeError(f"Ollama {MAX_RETRIES} kísérlet után sem válaszolt")


# ─────────────────────────────────────────────────────────────────────────────
# Fő Elemzési Függvény
# ─────────────────────────────────────────────────────────────────────────────

def analyze_trends(request: TrendAnalysisRequest) -> TrendAnalysisReport:
    """
    Trendanalízis végrehajtása.

    Mock módban statikus fallback adatokat használ.
    Éles módban Ollama LLM-et hív retry logikával.
    """
    start_time = time.time()

    if request.mock:
        print("[INFO] Mock mód – fallback trendek visszaadása", file=sys.stderr)
        trends = FALLBACK_TRENDS[: request.limit]
        return TrendAnalysisReport(
            query=request.query,
            trends=trends,
            total_found=len(trends),
            analysis_engine="mock_fallback",
            duration_seconds=time.time() - start_time,
        )

    # Éles mód: Ollama hívás
    try:
        trends = _call_ollama_with_retry(request.query, request.limit)
        return TrendAnalysisReport(
            query=request.query,
            trends=trends,
            total_found=len(trends),
            analysis_engine=f"ollama/{OLLAMA_MODEL}",
            duration_seconds=time.time() - start_time,
        )
    except Exception as e:
        print(f"[WARN] Ollama nem elérhető, fallback trendek: {e}", file=sys.stderr)
        trends = FALLBACK_TRENDS[: request.limit]
        return TrendAnalysisReport(
            query=request.query,
            trends=trends,
            total_found=len(trends),
            analysis_engine="fallback",
            duration_seconds=time.time() - start_time,
            error_message=str(e),
        )


# ─────────────────────────────────────────────────────────────────────────────
# CLI Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Brunella Trend Analyst Worker")
    parser.add_argument("query", nargs="?", help="Keresési lekérdezés")
    parser.add_argument("--limit", type=int, default=10, help="Max trendek (1-50)")
    parser.add_argument("--mock", action="store_true", help="Mock mód (teszt)")
    parser.add_argument("--markdown", action="store_true", help="Markdown outputot ír")
    args = parser.parse_args()

    # Stdin-ből is lehet küldeni JSON-t
    if not args.query and not sys.stdin.isatty():
        try:
            raw = sys.stdin.read()
            data = json.loads(raw)
            req = TrendAnalysisRequest(**data)
        except Exception as e:
            print(json.dumps({"error": f"Érvénytelen stdin JSON: {e}"}))
            sys.exit(1)
    elif args.query:
        req = TrendAnalysisRequest(query=args.query, limit=args.limit, mock=args.mock)
    else:
        print(json.dumps({"error": "Adj meg egy lekérdezést vagy küldj JSON-t stdin-en!"}))
        sys.exit(1)

    report = analyze_trends(req)

    if args.markdown:
        print(report.to_markdown())
    else:
        # Pydantic v2 kompatibilis
        print(report.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
