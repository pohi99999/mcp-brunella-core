from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)

from myai.agents.tech_harvester import TechHarvester


def make_harvester(targets: list[dict[str, object]]) -> TechHarvester:
    config = {
        "targets": targets,
        "globalKeywords": ["ai"],
        "harvesterSettings": {
            "maxItemsPerSource": 2,
            "timeoutSeconds": 10,
            "headless": True,
            "outputDir": "temp/test-harvest-results",
        },
    }
    logger = logging.getLogger("test-tech-harvester")
    return TechHarvester(config, logger)


def test_prefers_output_dir_alias() -> None:
    harvester = make_harvester([])
    assert harvester.output_dir == Path("temp/test-harvest-results")


def test_describe_target_supports_apify_without_url() -> None:
    harvester = make_harvester([])
    descriptor = harvester._describe_target({
        "type": "apify",
        "actor_id": "actor-123",
        "query": "openai news",
    })
    assert descriptor == "Apify actor=actor-123 query=openai news"


def test_run_harvest_uses_apify_targets_without_browser_initialization(monkeypatch) -> None:
    harvester = make_harvester([
        {
            "name": "Apify Google Search",
            "type": "apify",
            "actor_id": "actor-123",
            "query": "openai news",
            "enabled": True,
        }
    ])

    calls: list[str] = []

    async def fake_initialize_browser() -> None:
        calls.append("initialize_browser")

    async def fake_close_browser() -> None:
        calls.append("close_browser")

    async def fake_harvest_source_with_apify(target: dict[str, object]) -> list[dict[str, object]]:
        calls.append(str(target["name"]))
        return [{"title": "OpenAI update", "summary": "Important release"}]

    monkeypatch.setattr(harvester, "initialize_browser", fake_initialize_browser)
    monkeypatch.setattr(harvester, "close_browser", fake_close_browser)
    monkeypatch.setattr(harvester, "harvest_source_with_apify", fake_harvest_source_with_apify)
    monkeypatch.setattr(harvester, "_save_results", lambda: Path("temp/test-harvest-results/result.json"))

    summary = asyncio.run(harvester.run_harvest(mode="browser-use"))

    assert "initialize_browser" not in calls
    assert "Apify Google Search" in calls
    assert "close_browser" in calls
    assert summary["total_items_collected"] == 1
