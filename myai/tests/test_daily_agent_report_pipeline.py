from __future__ import annotations

import json
import subprocess
from pathlib import Path

from myai.tools.build_agent_news import build_agent_news
from myai.tools.daily_agent_report_builder import build_daily_agent_report
from myai.tools.daily_agent_report_pipeline import (
    PipelineOptions,
    run_daily_agent_report_pipeline,
)


def _write_harvest_file(base_dir: Path) -> Path:
    harvest_dir = base_dir / "harvest_results"
    harvest_dir.mkdir(parents=True, exist_ok=True)
    harvest_file = harvest_dir / "harvest_results_20260417_000001.json"
    harvest_file.write_text(
        json.dumps(
            {
                "harvested_at": "2026-04-17T00:00:01Z",
                "total_items": 2,
                "sources": ["LangChain Blog", "TechCrunch"],
                "items": [
                    {
                        "title": "LangGraph 0.5 released",
                        "summary": "LangGraph adds agentic workflow primitives and better tool routing.",
                        "url": "https://example.com/langgraph",
                        "source": "LangChain Blog",
                        "category": "framework",
                        "tags": ["ai agent", "LangGraph"],
                    },
                    {
                        "title": "Weekly startup funding roundup",
                        "summary": "A generic funding roundup without relevant keywords.",
                        "url": "https://example.com/funding",
                        "source": "TechCrunch",
                        "category": "news",
                    },
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return harvest_file


def test_build_agent_news_filters_and_writes_output(tmp_path: Path) -> None:
    harvest_file = _write_harvest_file(tmp_path)
    output_dir = tmp_path / "temp"

    document = build_agent_news(
        report_date="2026-04-17",
        harvest_file=harvest_file,
        output_dir=output_dir,
    )

    assert document.date == "2026-04-17"
    assert document.total_items == 1
    assert document.source_count == 2
    assert len(document.items) == 1
    assert document.items[0].title == "LangGraph 0.5 released"
    assert document.items[0].category == "framework"

    output_path = output_dir / "agent_news_2026-04-17.json"
    assert output_path.exists()
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["date"] == "2026-04-17"
    assert payload["items"][0]["source"] == "LangChain Blog"


def test_build_daily_agent_report_groups_sections_and_writes_markdown(tmp_path: Path) -> None:
    agent_news_path = tmp_path / "temp" / "agent_news_2026-04-17.json"
    agent_news_path.parent.mkdir(parents=True, exist_ok=True)
    agent_news_path.write_text(
        json.dumps(
            {
                "date": "2026-04-17",
                "generated_at": "2026-04-17T00:00:02Z",
                "source_file": "temp/harvest_results/harvest_results_20260417_000001.json",
                "total_items": 2,
                "source_count": 2,
                "items": [
                    {
                        "title": "LangGraph 0.5 released",
                        "url": "https://example.com/langgraph",
                        "summary": "LangGraph adds agentic workflow primitives and better tool routing.",
                        "source": "LangChain Blog",
                        "category": "framework",
                    },
                    {
                        "title": "EU AI Act update",
                        "url": "https://example.com/eu-ai-act",
                        "summary": "Compliance guidance and policy notes for enterprise teams.",
                        "source": "European Commission",
                        "category": "standard",
                    },
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    document = build_daily_agent_report(
        report_date="2026-04-17",
        agent_news_path=agent_news_path,
        output_dir=tmp_path / "docs",
    )

    assert document.date == "2026-04-17"
    assert document.items_count == 2
    assert document.report_path.endswith("002-Napi-AI-Agent-Jelentes-2026-04-17.md")

    report_path = Path(document.report_path)
    assert report_path.exists()
    content = report_path.read_text(encoding="utf-8")
    assert "# Napi AI Agent Jelentés – 2026-04-17" in content
    assert "## Framework radar" in content
    assert "LangGraph 0.5 released" in content
    assert "## Brunella-specifikus javaslatok mára" in content


def test_run_daily_agent_report_pipeline_generates_full_output(tmp_path: Path, monkeypatch) -> None:
    harvest_dir = tmp_path / "temp" / "harvest_results"
    harvest_file = _write_harvest_file(tmp_path / "temp")
    output_dir = tmp_path / "docs"
    temp_dir = tmp_path / "temp"
    options = PipelineOptions(
        report_date="2026-04-17",
        harvest_mode="playwright",
        config_path=tmp_path / "config" / "sources.json",
        output_dir=output_dir,
        report_prefix="002-Napi-AI-Agent-Jelentes",
        harvest_dir=harvest_dir,
        temp_dir=temp_dir,
    )

    def fake_run_tech_harvester(_: PipelineOptions) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")

    monkeypatch.setattr(
        "myai.tools.daily_agent_report_pipeline._run_tech_harvester",
        fake_run_tech_harvester,
    )

    result = run_daily_agent_report_pipeline(options)

    assert result.success is True
    assert result.report_date == "2026-04-17"
    assert result.items_count == 1
    assert result.source_count == 2
    assert Path(result.harvest_path) == harvest_file
    assert Path(result.agent_news_path).exists()
    assert Path(result.report_path).exists()
    assert "Napi AI Agent Jelentés – 2026-04-17" in Path(result.report_path).read_text(encoding="utf-8")
