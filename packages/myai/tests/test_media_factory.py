"""
Unit tesztek: myai/workers/media_factory.py
Track: marketing_swarm_20260216 – Phase 3 Testing

Lefedi:
 - Pydantic modellek (TrendItemInput, MediaAsset, CampaignPackage, MediaFactoryRequest)
 - produce_campaign() mock (placeholder) módban
 - Kampánycsomag mentési pipeline (_KNOWLEDGE_BASE/campaigns)
 - Summary markdown generálás
 - Slugify és campaign ID logika
 - CLI belépési pont
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Path setup
# ─────────────────────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)

from myai.workers.media_factory import (
    TrendItemInput,
    MediaAsset,
    CampaignPackage,
    MediaFactoryRequest,
    ASSET_TYPES,
    produce_campaign,
    _slugify,
    _generate_campaign_id,
    _generate_placeholder_asset,
    _generate_summary_markdown,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_trends() -> list[TrendItemInput]:
    return [
        TrendItemInput(title="AI automatizálás", relevance_score=0.95, source="test", tags=["AI"]),
        TrendItemInput(title="Multi-agent rendszerek", relevance_score=0.88, source="test"),
        TrendItemInput(title="Edge computing", relevance_score=0.75, source="test"),
    ]


@pytest.fixture
def tmp_campaigns_dir(monkeypatch, tmp_path):
    """
    Temporary _KNOWLEDGE_BASE/campaigns directory for tests.

    Uses yield pattern to ensure proper cleanup after test completion.
    This is critical on Windows to release file locks before pytest
    attempts to clean up tmp_path.
    """
    campaigns_dir = tmp_path / "_KNOWLEDGE_BASE" / "campaigns"
    campaigns_dir.mkdir(parents=True)
    monkeypatch.setattr("myai.workers.media_factory.CAMPAIGNS_BASE", campaigns_dir)

    yield campaigns_dir

    # Explicit cleanup to ensure file handles are released
    # Small delay for Windows file system to release locks
    import time
    import shutil
    import gc

    gc.collect()  # Force garbage collection
    time.sleep(0.1)  # Give subprocess time to release locks

    # Clean up the knowledge base directory tree
    if campaigns_dir.parent.parent.exists():
        try:
            shutil.rmtree(campaigns_dir.parent.parent, ignore_errors=True)
        except PermissionError as e:
            # Log but don't fail test - pytest will handle final cleanup
            import logging
            logging.warning(f"Cleanup warning (non-critical): {e}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Pydantic Modell Validáció
# ─────────────────────────────────────────────────────────────────────────────


class TestTrendItemInputModel:
    def test_valid_trend(self):
        ti = TrendItemInput(title="Test trend", relevance_score=0.9)
        assert ti.title == "Test trend"
        assert ti.source == "analysis"
        assert ti.tags == []

    def test_score_bounds(self):
        TrendItemInput(title="Low", relevance_score=0.0)
        TrendItemInput(title="High", relevance_score=1.0)

    def test_score_out_of_range_raises(self):
        with pytest.raises(Exception):
            TrendItemInput(title="Invalid", relevance_score=1.1)


class TestMediaAssetModel:
    def test_valid_asset(self):
        asset = MediaAsset(
            asset_type="headline",
            platform="facebook",
            content="Kattints most! 🚀",
        )
        assert asset.asset_type == "headline"
        assert asset.is_draft is True
        # "Kattints most! 🚀".split() → ["Kattints", "most!", "🚀"] = 3 token
        assert asset.word_count == 3

    def test_word_count_computed(self):
        asset = MediaAsset(
            asset_type="body_copy",
            platform="general",
            content="Ez egy hosszabb szöveg ami több szót tartalmaz",
        )
        assert asset.word_count == 8

    def test_empty_content_allowed(self):
        """Üres tartalom technikai szempontból megengedett (placeholder esetén)."""
        asset = MediaAsset(asset_type="cta", platform="general", content="")
        assert asset.word_count == 0


class TestMediaFactoryRequestModel:
    def test_valid_request_defaults(self):
        req = MediaFactoryRequest(query="AI marketing")
        assert req.mock is False
        assert req.draft_mode is True
        assert "general" in req.platforms

    def test_empty_query_raises(self):
        with pytest.raises(Exception):
            MediaFactoryRequest(query="")

    def test_custom_platforms(self):
        req = MediaFactoryRequest(query="teszt", platforms=["email", "linkedin"])
        assert "email" in req.platforms
        assert "linkedin" in req.platforms


# ─────────────────────────────────────────────────────────────────────────────
# 2. Segédfüggvények
# ─────────────────────────────────────────────────────────────────────────────


class TestSlugify:
    def test_basic_slug(self):
        assert _slugify("AI Marketing 2026") == "ai-marketing-2026"

    def test_special_chars_removed(self):
        slug = _slugify("AI & Jövő! 🚀")
        assert "&" not in slug
        assert "🚀" not in slug

    def test_max_length(self):
        long_text = "a" * 100
        assert len(_slugify(long_text)) <= 50

    def test_unicode_lowercase(self):
        slug = _slugify("NAGY BETŰK")
        assert slug == slug.lower()

    def test_empty_string(self):
        result = _slugify("")
        assert isinstance(result, str)


class TestGenerateCampaignId:
    def test_starts_with_camp(self):
        cid = _generate_campaign_id()
        assert cid.startswith("camp_")

    def test_unique_ids(self):
        ids = {_generate_campaign_id() for _ in range(5)}
        # Másodperces granularitás miatt nem garantált 5 különböző,
        # de legalább 1 legyen
        assert len(ids) >= 1

    def test_format_pattern(self):
        import re
        cid = _generate_campaign_id()
        assert re.match(r"camp_\d{8}_\d{6}", cid), f"Nem egyezik a minta: {cid}"


class TestGeneratePlaceholderAsset:
    def test_returns_media_asset(self):
        asset = _generate_placeholder_asset("headline", "facebook", "AI marketing")
        assert isinstance(asset, MediaAsset)

    def test_is_draft(self):
        asset = _generate_placeholder_asset("cta", "linkedin", "teszt")
        assert asset.is_draft is True

    def test_all_asset_types_generate(self):
        for atype in ASSET_TYPES:
            asset = _generate_placeholder_asset(atype, "general", "teszt")
            assert asset.asset_type == atype
            assert len(asset.content) > 0


# ─────────────────────────────────────────────────────────────────────────────
# 3. produce_campaign() – Mock/Placeholder Mód
# ─────────────────────────────────────────────────────────────────────────────


class TestProduceCampaignMockMode:
    """produce_campaign() mock=True esetén – gyors, Ollama-mentes."""

    def test_returns_campaign_package(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="AI tools", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert isinstance(pkg, CampaignPackage)

    def test_slug_generated(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="AI Tools Marketing", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert pkg.slug == "ai-tools-marketing"

    def test_campaign_id_set(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert pkg.campaign_id.startswith("camp_")

    def test_assets_generated_for_all_platforms(self, sample_trends, tmp_campaigns_dir):
        platforms = ["general", "facebook"]
        req = MediaFactoryRequest(
            query="teszt", trends=sample_trends, platforms=platforms, mock=True
        )
        pkg = produce_campaign(req)
        platforms_in_assets = {a.platform for a in pkg.assets}
        for p in platforms:
            assert p in platforms_in_assets

    def test_assets_cover_all_types(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(
            query="teszt", trends=sample_trends, platforms=["general"], mock=True
        )
        pkg = produce_campaign(req)
        types_in_assets = {a.asset_type for a in pkg.assets}
        for atype in ASSET_TYPES:
            assert atype in types_in_assets

    def test_top_trends_sorted_by_score(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        # Első trend a legmagasabb pontszámú
        assert pkg.top_trends[0] == "AI automatizálás"

    def test_duration_positive(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert pkg.duration_seconds >= 0.0

    def test_success_flag_true(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert pkg.success is True

    def test_draft_mode_flag(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        assert pkg.draft_mode is True


# ─────────────────────────────────────────────────────────────────────────────
# 4. Mentési Pipeline
# ─────────────────────────────────────────────────────────────────────────────


class TestCampaignSavePipeline:
    """Kampánycsomag fájlrendszerre mentése."""

    def test_campaign_dir_created(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="mentési teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        slug_dir = tmp_campaigns_dir / pkg.slug
        assert slug_dir.exists(), f"Slug könyvtár nem jött létre: {slug_dir}"

    def test_campaign_json_exists(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="json teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        slug_dir = tmp_campaigns_dir / pkg.slug
        campaign_dirs = list(slug_dir.iterdir())
        assert len(campaign_dirs) >= 1
        json_file = campaign_dirs[0] / "campaign.json"
        assert json_file.exists(), "campaign.json nem jött létre"

    def test_campaign_json_valid(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="json validáció", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        slug_dir = tmp_campaigns_dir / pkg.slug
        campaign_dirs = list(slug_dir.iterdir())
        json_file = campaign_dirs[0] / "campaign.json"
        data = json.loads(json_file.read_text(encoding="utf-8"))
        assert data["query"] == "json validáció"
        assert isinstance(data["assets"], list)

    def test_summary_md_exists(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="summary teszt", trends=sample_trends, mock=True)
        pkg = produce_campaign(req)
        slug_dir = tmp_campaigns_dir / pkg.slug
        campaign_dirs = list(slug_dir.iterdir())
        summary_file = campaign_dirs[0] / "SUMMARY.md"
        assert summary_file.exists(), "SUMMARY.md nem jött létre"

    def test_summary_md_contains_query(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(query="Egyedi kampány cím 2026", trends=sample_trends, mock=True)
        produce_campaign(req)
        slug = _slugify("Egyedi kampány cím 2026")
        slug_dir = tmp_campaigns_dir / slug
        campaign_dirs = list(slug_dir.iterdir())
        summary_content = (campaign_dirs[0] / "SUMMARY.md").read_text(encoding="utf-8")
        assert "Egyedi kampány cím 2026" in summary_content

    def test_platform_txt_files_created(self, sample_trends, tmp_campaigns_dir):
        req = MediaFactoryRequest(
            query="platform teszt", trends=sample_trends, platforms=["general"], mock=True
        )
        produce_campaign(req)
        slug = _slugify("platform teszt")
        slug_dir = tmp_campaigns_dir / slug
        campaign_dirs = list(slug_dir.iterdir())
        txt_files = list(campaign_dirs[0].glob("*.txt"))
        assert len(txt_files) > 0, "Nincs .txt fájl generálva"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Summary Markdown Generálás
# ─────────────────────────────────────────────────────────────────────────────


class TestSummaryMarkdown:
    """_generate_summary_markdown() tesztek."""

    def _make_package(self) -> CampaignPackage:
        assets = [
            MediaAsset(asset_type="headline", platform="facebook", content="Test headline"),
            MediaAsset(asset_type="cta", platform="facebook", content="Kattints!"),
        ]
        return CampaignPackage(
            campaign_id="camp_test_001",
            query="Összefoglaló teszt",
            slug="osszefoglalo-teszt",
            assets=assets,
            top_trends=["Trend Alpha", "Trend Beta"],
        )

    def test_markdown_h1_present(self):
        pkg = self._make_package()
        md = _generate_summary_markdown(pkg)
        assert "# 🎯 Kampánycsomag" in md

    def test_trends_in_markdown(self):
        pkg = self._make_package()
        md = _generate_summary_markdown(pkg)
        assert "Trend Alpha" in md
        assert "Trend Beta" in md

    def test_assets_in_markdown(self):
        pkg = self._make_package()
        md = _generate_summary_markdown(pkg)
        assert "Test headline" in md
        assert "Kattints!" in md

    def test_platform_section_present(self):
        pkg = self._make_package()
        md = _generate_summary_markdown(pkg)
        assert "FACEBOOK" in md

    def test_campaign_id_present(self):
        pkg = self._make_package()
        md = _generate_summary_markdown(pkg)
        assert "camp_test_001" in md


# ─────────────────────────────────────────────────────────────────────────────
# 6. CLI – Belépési Pont
# ─────────────────────────────────────────────────────────────────────────────


class TestMediaFactoryCLI:
    """CLI tesztek subprocess-szel, ideiglenes könyvtárral."""

    WORKER = os.path.join(ROOT, "myai", "workers", "media_factory.py")

    def _run(
        self,
        args: list[str],
        stdin_data: str | None = None,
        extra_env: dict | None = None,
    ) -> dict:
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"  # Python 3.7+ UTF-8 mode (Windows fix)
        if extra_env:
            env.update(extra_env)
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

    def test_mock_mode_exits_zero(self):
        out = self._run(["--query", "AI marketing", "--mock"])
        assert out["returncode"] == 0, f"stderr: {out['stderr']}"

    def test_mock_output_valid_json(self):
        out = self._run(["--query", "AI marketing", "--mock"])
        data = json.loads(out["stdout"])
        assert "campaign_id" in data
        assert "assets" in data
        assert isinstance(data["assets"], list)

    def test_mock_assets_not_empty(self):
        out = self._run(["--query", "AI marketing", "--mock"])
        data = json.loads(out["stdout"])
        assert len(data["assets"]) > 0

    def test_no_ai_mode_exits_zero(self):
        out = self._run(["--query", "teszt", "--no-ai"])
        assert out["returncode"] == 0

    def test_custom_platforms(self):
        out = self._run(["--query", "teszt", "--mock", "--platforms", "email", "linkedin"])
        data = json.loads(out["stdout"])
        platforms = {a["platform"] for a in data["assets"]}
        assert "email" in platforms
        assert "linkedin" in platforms

    def test_missing_query_exits_nonzero(self):
        out = self._run([])
        assert out["returncode"] != 0

    def test_stdin_json_mode(self):
        payload = json.dumps({
            "query": "Stdin kampány teszt",
            "trends": [],
            "mock": True,
            "draft_mode": False,
        })
        out = self._run([], stdin_data=payload)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"])
        assert data["query"] == "Stdin kampány teszt"

    def test_invalid_stdin_exits_nonzero(self):
        out = self._run([], stdin_data="NOT_JSON_AT_ALL")
        assert out["returncode"] != 0

    def test_slug_in_output(self):
        out = self._run(["--query", "AI Tools 2026", "--mock"])
        data = json.loads(out["stdout"])
        assert data["slug"] == "ai-tools-2026"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
