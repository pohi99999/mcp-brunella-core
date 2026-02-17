"""
Integrációs tesztek: Marketing Swarm – Teljes Pipeline
Track: marketing_swarm_20260216

Teszt forgatókönyv:
  1. trend_analyst.py → TrendAnalysisReport (mock módban)
  2. A trendeket átadjuk a media_factory.py-nak
  3. CampaignPackage keletkezik, fájlok mentve
  4. Ellenőrzük az egész pipeline kimenetét

Isolation: Saját tmp könyvtár, Ollama nem szükséges (mock mód).
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Path setup
# ─────────────────────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)

from myai.workers.trend_analyst import (
    TrendAnalysisRequest,
    analyze_trends,
)
from myai.workers.media_factory import (
    MediaFactoryRequest,
    TrendItemInput,
    produce_campaign,
    _slugify,
    ASSET_TYPES,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_campaigns(monkeypatch, tmp_path):
    """Ideiglenes kampány mentési könyvtár."""
    campaigns_dir = tmp_path / "_KNOWLEDGE_BASE" / "campaigns"
    campaigns_dir.mkdir(parents=True)
    monkeypatch.setattr("myai.workers.media_factory.CAMPAIGNS_BASE", campaigns_dir)
    return campaigns_dir


# ─────────────────────────────────────────────────────────────────────────────
# Integrációs tesztek
# ─────────────────────────────────────────────────────────────────────────────


class TestFullMarketingSwarmPipeline:
    """
    Teljes pipeline integráció:
      trend_analyst → media_factory → fájlrendszer
    """

    def test_pipeline_end_to_end_mock(self, tmp_campaigns):
        """
        Lépések:
          1. Trend analyst futtatás (mock mód)
          2. Trendek átadása media factory-nak
          3. Kampánycsomag ellenőrzése
          4. Fájlrendszer ellenőrzése
        """
        # --- 1. LÉPÉS: Trendanalízis ---
        trend_request = TrendAnalysisRequest(
            query="AI marketing eszközök 2026",
            limit=5,
            mock=True,
        )
        trend_report = analyze_trends(trend_request)

        assert trend_report.success is True
        assert len(trend_report.trends) == 5
        assert trend_report.query == "AI marketing eszközök 2026"

        # --- 2. LÉPÉS: Trendeket Media Factory-ba ---
        trend_inputs = [
            TrendItemInput(
                title=t.title,
                relevance_score=t.relevance_score,
                source=t.source,
                tags=t.tags,
                summary=t.summary,
            )
            for t in trend_report.trends
        ]

        factory_request = MediaFactoryRequest(
            query=trend_report.query,
            trends=trend_inputs,
            platforms=["general", "facebook", "linkedin"],
            mock=True,  # Placeholder assetek (gyors, Ollama nélkül)
        )
        campaign = produce_campaign(factory_request)

        # --- 3. LÉPÉS: Kampánycsomag validáció ---
        assert campaign.success is True
        assert campaign.query == "AI marketing eszközök 2026"
        assert len(campaign.assets) > 0
        assert len(campaign.top_trends) > 0

        # Minden ASSET_TYPE megvan minden platformon
        for platform in ["general", "facebook", "linkedin"]:
            platform_assets = [a for a in campaign.assets if a.platform == platform]
            asset_types = {a.asset_type for a in platform_assets}
            for atype in ASSET_TYPES:
                assert atype in asset_types, (
                    f"Hiányzó asset typ '{atype}' a '{platform}' platformon"
                )

        # --- 4. LÉPÉS: Fájlrendszer ellenőrzése ---
        slug = campaign.slug
        assert slug  # nem üres

        slug_dir = tmp_campaigns / slug
        assert slug_dir.exists(), f"Slug könyvtár nem jött létre: {slug_dir}"

        campaign_dirs = list(slug_dir.iterdir())
        assert len(campaign_dirs) == 1, "Pontosan 1 kampány-alkönyvtár kell"

        campaign_dir = campaign_dirs[0]
        assert (campaign_dir / "campaign.json").exists()
        assert (campaign_dir / "SUMMARY.md").exists()

    def test_pipeline_json_round_trip(self, tmp_campaigns):
        """campaign.json visszaolvasható és konzisztens a CampaignPackage-gel."""
        trend_req = TrendAnalysisRequest(query="JSON round trip teszt", limit=3, mock=True)
        trend_report = analyze_trends(trend_req)

        trend_inputs = [
            TrendItemInput(
                title=t.title,
                relevance_score=t.relevance_score,
                source=t.source,
            )
            for t in trend_report.trends
        ]

        factory_req = MediaFactoryRequest(
            query="JSON round trip teszt",
            trends=trend_inputs,
            platforms=["general"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)

        # Olvassuk vissza
        slug_dir = tmp_campaigns / campaign.slug
        campaign_dir = list(slug_dir.iterdir())[0]
        raw = (campaign_dir / "campaign.json").read_text(encoding="utf-8")
        data = json.loads(raw)

        assert data["query"] == campaign.query
        assert data["campaign_id"] == campaign.campaign_id
        assert data["slug"] == campaign.slug
        assert len(data["assets"]) == len(campaign.assets)

    def test_pipeline_summary_contains_trends(self, tmp_campaigns):
        """SUMMARY.md tartalmazza a trend analyst által talált trendeket."""
        trend_req = TrendAnalysisRequest(query="Summary tartalom teszt", limit=3, mock=True)
        trend_report = analyze_trends(trend_req)
        top_trend_title = trend_report.trends[0].title

        trend_inputs = [
            TrendItemInput(title=t.title, relevance_score=t.relevance_score)
            for t in trend_report.trends
        ]

        factory_req = MediaFactoryRequest(
            query="Summary tartalom teszt",
            trends=trend_inputs,
            platforms=["general"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)

        slug_dir = tmp_campaigns / campaign.slug
        campaign_dir = list(slug_dir.iterdir())[0]
        summary = (campaign_dir / "SUMMARY.md").read_text(encoding="utf-8")

        assert top_trend_title in summary
        assert "# 🎯 Kampánycsomag" in summary

    def test_pipeline_multiple_products(self, tmp_campaigns):
        """Több különböző termékre egymás után futtatva nem keverednek az adatok."""
        products = ["Elektromos autó", "Okos otthon", "AI szoftver"]

        for product in products:
            trend_req = TrendAnalysisRequest(query=product, limit=3, mock=True)
            trend_report = analyze_trends(trend_req)
            trend_inputs = [
                TrendItemInput(title=t.title, relevance_score=t.relevance_score)
                for t in trend_report.trends
            ]
            factory_req = MediaFactoryRequest(
                query=product,
                trends=trend_inputs,
                platforms=["general"],
                mock=True,
            )
            campaign = produce_campaign(factory_req)
            assert campaign.query == product

        # Ellenőrzük hogy mindhárom kampány könyvtár létrejött
        all_slugs = {_slugify(p) for p in products}
        existing = {d.name for d in tmp_campaigns.iterdir() if d.is_dir()}
        for slug in all_slugs:
            assert slug in existing, f"Hiányzó kampány könyvtár: {slug}"

    def test_pipeline_trend_score_order_preserved(self, tmp_campaigns):
        """A legjobb score-ú trend először szerepel a kampányban."""
        trend_req = TrendAnalysisRequest(query="Score sorrend teszt", limit=5, mock=True)
        trend_report = analyze_trends(trend_req)
        # Fallback trendek csökkenő score szerint rendezve
        scores = [t.relevance_score for t in trend_report.trends]
        assert scores == sorted(scores, reverse=True)

        trend_inputs = [
            TrendItemInput(title=t.title, relevance_score=t.relevance_score)
            for t in trend_report.trends
        ]
        factory_req = MediaFactoryRequest(
            query="Score sorrend teszt",
            trends=trend_inputs,
            platforms=["general"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)
        # Legmagasabb relevancia az első top_trend
        assert campaign.top_trends[0] == trend_report.trends[0].title


class TestPipelineEdgeCases:
    """Pipeline éles esetek és edge case-ek."""

    def test_pipeline_with_no_trends(self, tmp_campaigns):
        """Ha a trend analyst 0 trendet ad vissza, a factory üres trend listával fut."""
        factory_req = MediaFactoryRequest(
            query="Üres trendlista teszt",
            trends=[],
            platforms=["general"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)
        assert campaign.success is True
        assert campaign.top_trends == []
        # Asseteket azért generáljon (query-re)
        assert len(campaign.assets) > 0

    def test_pipeline_single_platform(self, tmp_campaigns):
        """Egyetlen platformra is megfelelően kell lefutnia."""
        trend_inputs = [TrendItemInput(title="Egyetlen trend", relevance_score=0.9)]
        factory_req = MediaFactoryRequest(
            query="Egy platform teszt",
            trends=trend_inputs,
            platforms=["email"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)
        platforms_in_assets = {a.platform for a in campaign.assets}
        assert platforms_in_assets == {"email"}

    def test_pipeline_query_with_special_chars(self, tmp_campaigns):
        """Speciális karakterek a query-ben nem okoznak crash-t."""
        factory_req = MediaFactoryRequest(
            query="AI & Jövő! (2026) – Mit hoz?",
            trends=[],
            platforms=["general"],
            mock=True,
        )
        campaign = produce_campaign(factory_req)
        assert campaign.success is True
        assert isinstance(campaign.slug, str)
        assert len(campaign.slug) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
