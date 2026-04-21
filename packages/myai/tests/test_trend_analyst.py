"""
Unit tesztek: myai/workers/trend_analyst.py
Track: marketing_swarm_20260216 – Phase 2 Testing

Lefedi:
 - Pydantic modellek validációja (TrendItem, TrendAnalysisRequest, TrendAnalysisReport)
 - analyze_trends() mock módban (Ollama nélkül)
 - Timeout fallback viselkedés
 - CLI belépési pont (stdin + args)
 - Markdown generálás
"""
from __future__ import annotations

import json
import sys
import os
import subprocess
from datetime import datetime
from io import StringIO
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Path setup – projekt gyökér
# ─────────────────────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)

from myai.workers.trend_analyst import (
    TrendItem,
    TrendAnalysisRequest,
    TrendAnalysisReport,
    FALLBACK_TRENDS,
    analyze_trends,
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pydantic Modell Validáció
# ─────────────────────────────────────────────────────────────────────────────


class TestTrendItemModel:
    """TrendItem Pydantic modell egységtesztek."""

    def test_valid_trend_item(self):
        item = TrendItem(
            title="AI automatizálás",
            relevance_score=0.92,
            source="test",
            tags=["AI", "automatizálás"],
            summary="Rövid összefoglaló",
        )
        assert item.title == "AI automatizálás"
        assert item.relevance_score == 0.92
        assert "AI" in item.tags

    def test_title_whitespace_stripped(self):
        item = TrendItem(title="  Trend cím  ", relevance_score=0.5)
        assert item.title == "Trend cím"

    def test_empty_title_raises(self):
        with pytest.raises(Exception):  # pydantic ValidationError
            TrendItem(title="   ", relevance_score=0.5)

    def test_score_boundary_valid(self):
        """Határ értékek elfogadottak."""
        low = TrendItem(title="Low", relevance_score=0.0)
        high = TrendItem(title="High", relevance_score=1.0)
        assert low.relevance_score == 0.0
        assert high.relevance_score == 1.0

    def test_score_out_of_range_raises(self):
        with pytest.raises(Exception):
            TrendItem(title="Invalid", relevance_score=1.5)

    def test_negative_score_raises(self):
        with pytest.raises(Exception):
            TrendItem(title="Invalid", relevance_score=-0.1)

    def test_default_values(self):
        """Alapértelmezett értékek ellenőrzése."""
        item = TrendItem(title="Minimal", relevance_score=0.5)
        assert item.source == "analysis"
        assert item.tags == []
        assert item.summary == ""


class TestTrendAnalysisRequestModel:
    """TrendAnalysisRequest validáció."""

    def test_valid_request(self):
        req = TrendAnalysisRequest(query="AI eszközök 2026", limit=10, mock=True)
        assert req.query == "AI eszközök 2026"
        assert req.limit == 10
        assert req.mock is True

    def test_default_limit_and_mock(self):
        req = TrendAnalysisRequest(query="teszt")
        assert req.limit == 10
        assert req.mock is False

    def test_empty_query_raises(self):
        with pytest.raises(Exception):
            TrendAnalysisRequest(query="")

    def test_limit_upper_bound(self):
        req = TrendAnalysisRequest(query="q", limit=50)
        assert req.limit == 50

    def test_limit_exceeds_max_raises(self):
        with pytest.raises(Exception):
            TrendAnalysisRequest(query="q", limit=51)

    def test_limit_zero_raises(self):
        with pytest.raises(Exception):
            TrendAnalysisRequest(query="q", limit=0)


class TestTrendAnalysisReportModel:
    """TrendAnalysisReport validáció és metódusok."""

    def _make_report(self, trends: list[TrendItem] | None = None) -> TrendAnalysisReport:
        if trends is None:
            trends = [TrendItem(title="Test trend", relevance_score=0.8)]
        return TrendAnalysisReport(
            query="teszt lekérdezés",
            trends=trends,
            total_found=len(trends),
            duration_seconds=1.23,
        )

    def test_report_fields(self):
        report = self._make_report()
        assert report.query == "teszt lekérdezés"
        assert report.total_found == 1
        assert report.success is True
        assert report.error_message is None

    def test_generated_at_is_recent(self):
        report = self._make_report()
        delta = (datetime.utcnow() - report.generated_at).total_seconds()
        assert delta < 5.0, "generated_at nem friss"

    def test_to_markdown_contains_query(self):
        report = self._make_report()
        md = report.to_markdown()
        assert "teszt lekérdezés" in md

    def test_to_markdown_contains_trends(self):
        trends = [
            TrendItem(title="Trend Alpha", relevance_score=0.9),
            TrendItem(title="Trend Beta", relevance_score=0.7),
        ]
        report = self._make_report(trends)
        md = report.to_markdown()
        assert "Trend Alpha" in md
        assert "Trend Beta" in md

    def test_to_markdown_contains_headers(self):
        report = self._make_report()
        md = report.to_markdown()
        assert "# 🔍 Trendanalízis" in md
        assert "## 📊 Trendek" in md

    def test_json_serializable(self):
        report = self._make_report()
        raw = report.model_dump_json()
        data = json.loads(raw)
        assert data["query"] == "teszt lekérdezés"
        assert isinstance(data["trends"], list)


# ─────────────────────────────────────────────────────────────────────────────
# 2. analyze_trends() – Mock Mód
# ─────────────────────────────────────────────────────────────────────────────


class TestAnalyzeTrendsMockMode:
    """analyze_trends() viselkedése mock=True esetén."""

    def test_returns_report_type(self):
        req = TrendAnalysisRequest(query="AI tools", mock=True)
        report = analyze_trends(req)
        assert isinstance(report, TrendAnalysisReport)

    def test_mock_uses_fallback_engine(self):
        req = TrendAnalysisRequest(query="teszt", mock=True)
        report = analyze_trends(req)
        assert report.analysis_engine == "mock_fallback"

    def test_mock_returns_trends(self):
        req = TrendAnalysisRequest(query="teszt", limit=3, mock=True)
        report = analyze_trends(req)
        assert len(report.trends) == 3

    def test_mock_respects_limit(self):
        for limit in [1, 3, 5]:
            req = TrendAnalysisRequest(query="teszt", limit=limit, mock=True)
            report = analyze_trends(req)
            assert len(report.trends) == limit

    def test_mock_success_flag(self):
        req = TrendAnalysisRequest(query="teszt", mock=True)
        report = analyze_trends(req)
        assert report.success is True

    def test_mock_duration_positive(self):
        req = TrendAnalysisRequest(query="teszt", mock=True)
        report = analyze_trends(req)
        assert report.duration_seconds >= 0.0

    def test_mock_trends_are_valid_trend_items(self):
        req = TrendAnalysisRequest(query="teszt", limit=5, mock=True)
        report = analyze_trends(req)
        for item in report.trends:
            assert isinstance(item, TrendItem)
            assert 0.0 <= item.relevance_score <= 1.0

    def test_mock_query_preserved(self):
        req = TrendAnalysisRequest(query="Egyedi keresési kifejezés", mock=True)
        report = analyze_trends(req)
        assert report.query == "Egyedi keresési kifejezés"


# ─────────────────────────────────────────────────────────────────────────────
# 3. analyze_trends() – Ollama Fallback (Éles mód, Ollama nélkül)
# ─────────────────────────────────────────────────────────────────────────────


class TestAnalyzeTrendsOllamaFallback:
    """Ha az Ollama nem elérhető, fallback trendeket kell visszaadni."""

    def test_fallback_when_ollama_unreachable(self):
        """Ollama connection error esetén fallback-et ad vissza."""
        req = TrendAnalysisRequest(query="AI automatizálás", mock=False, limit=3)

        # httpx-et mockoljuk ConnectionError-t dobni
        with patch("myai.workers.trend_analyst.HTTPX_AVAILABLE", True):
            with patch("myai.workers.trend_analyst._call_ollama_with_retry") as mock_call:
                mock_call.side_effect = RuntimeError("Ollama nem érhető el")
                report = analyze_trends(req)

        assert isinstance(report, TrendAnalysisReport)
        assert report.analysis_engine == "fallback"
        assert len(report.trends) > 0
        assert report.success is True  # Fallback esetén is success=True
        assert report.error_message is not None

    def test_fallback_respects_limit(self):
        req = TrendAnalysisRequest(query="teszt", mock=False, limit=2)
        with patch("myai.workers.trend_analyst._call_ollama_with_retry") as mock_call:
            mock_call.side_effect = RuntimeError("timeout")
            report = analyze_trends(req)

        assert len(report.trends) == 2

    def test_live_mode_calls_ollama(self):
        """Éles módban meghívja az Ollama-t (mockolva)."""
        mock_trends = [TrendItem(title=f"Trend {i}", relevance_score=0.8) for i in range(3)]

        req = TrendAnalysisRequest(query="marketing AI", mock=False, limit=3)
        with patch("myai.workers.trend_analyst._call_ollama_with_retry") as mock_call:
            mock_call.return_value = mock_trends
            report = analyze_trends(req)

        mock_call.assert_called_once_with("marketing AI", 3)
        assert report.trends == mock_trends
        assert "ollama" in report.analysis_engine


# ─────────────────────────────────────────────────────────────────────────────
# 4. Fallback Konstans Validáció
# ─────────────────────────────────────────────────────────────────────────────


class TestFallbackTrends:
    """FALLBACK_TRENDS konstans validáció."""

    def test_fallback_not_empty(self):
        assert len(FALLBACK_TRENDS) >= 3, "Legalább 3 fallback trendet várok"

    def test_fallback_all_valid_trend_items(self):
        for item in FALLBACK_TRENDS:
            assert isinstance(item, TrendItem)
            assert 0.0 <= item.relevance_score <= 1.0
            assert len(item.title) > 0

    def test_fallback_source_is_fallback(self):
        for item in FALLBACK_TRENDS:
            assert item.source == "fallback"

    def test_fallback_sorted_by_score_desc(self):
        """Fallback trendek relevánsak maradnak csökkenő sorrendben."""
        scores = [item.relevance_score for item in FALLBACK_TRENDS]
        assert scores == sorted(scores, reverse=True), "Fallback trendek nem csökkenő sorrendben"


# ─────────────────────────────────────────────────────────────────────────────
# 5. CLI – Belépési Pont stdout Ellenőrzés
# ─────────────────────────────────────────────────────────────────────────────


class TestCLI:
    """CLI belépési pont tesztek subprocess-szel."""

    WORKER = os.path.join(ROOT, "myai", "workers", "trend_analyst.py")

    def _run(self, args: list[str], stdin_data: str | None = None) -> dict[str, Any]:
        """Helper: subprocess futtatás, JSON parse."""
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"  # Python 3.7+ UTF-8 mode (Windows fix)
        result = subprocess.run(
            [sys.executable, self.WORKER] + args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
            input=stdin_data,
            cwd=ROOT,
            env=env,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }

    def test_cli_mock_mode_exits_zero(self):
        out = self._run(["AI eszközök", "--mock"])
        assert out["returncode"] == 0, f"stderr: {out['stderr']}"

    def test_cli_mock_output_is_valid_json(self):
        out = self._run(["AI eszközök", "--mock"])
        data = json.loads(out["stdout"])
        assert "trends" in data
        assert "query" in data
        assert isinstance(data["trends"], list)

    def test_cli_mock_limit_respected(self):
        out = self._run(["AI eszközök", "--mock", "--limit", "2"])
        data = json.loads(out["stdout"])
        assert len(data["trends"]) == 2

    def test_cli_markdown_mode(self):
        out = self._run(["AI eszközök", "--mock", "--markdown"])
        assert "# 🔍 Trendanalízis" in out["stdout"]

    def test_cli_stdin_json(self):
        """Stdin JSON bemenet feldolgozása."""
        payload = json.dumps({"query": "Stdin teszt", "limit": 3, "mock": True})
        out = self._run([], stdin_data=payload)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"])
        assert data["query"] == "Stdin teszt"

    def test_cli_missing_query_exits_nonzero(self):
        """Query nélkül és stdin nélkül hibás kilépés."""
        out = self._run([])
        assert out["returncode"] != 0

    def test_cli_invalid_stdin_json_exits_nonzero(self):
        """Érvénytelen JSON stdin esetén hibás kilépés."""
        out = self._run([], stdin_data="INVALID JSON {{{")
        assert out["returncode"] != 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
