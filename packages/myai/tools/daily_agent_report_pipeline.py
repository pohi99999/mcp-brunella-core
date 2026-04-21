from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from myai.tools.build_agent_news import AgentNewsItem, build_agent_news
from myai.tools.daily_agent_report_builder import build_daily_agent_report


class DailyAgentReportPipelineResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    success: bool
    message: str
    report_date: str
    harvest_path: str
    agent_news_path: str
    report_path: str
    items_count: int
    source_count: int
    status: str
    items: list[AgentNewsItem] = Field(default_factory=list)


@dataclass(slots=True)
class PipelineOptions:
    report_date: str
    harvest_mode: str
    config_path: Path
    output_dir: Path
    report_prefix: str
    harvest_dir: Path
    temp_dir: Path


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def _latest_harvest_file(harvest_dir: Path) -> Path:
    candidates = sorted(harvest_dir.glob("harvest_results_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"No harvest results found in {harvest_dir}")
    return candidates[0]


def _run_tech_harvester(options: PipelineOptions) -> subprocess.CompletedProcess[str]:
    root = _root()
    command = [
        sys.executable,
        str(root / "myai" / "agents" / "tech_harvester.py"),
        "--mode",
        options.harvest_mode,
        "--config",
        str(options.config_path),
    ]
    return subprocess.run(command, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="ignore")


def run_daily_agent_report_pipeline(options: PipelineOptions) -> DailyAgentReportPipelineResult:
    options.temp_dir.mkdir(parents=True, exist_ok=True)
    options.output_dir.mkdir(parents=True, exist_ok=True)
    options.harvest_dir.mkdir(parents=True, exist_ok=True)

    harvest_run = _run_tech_harvester(options)
    if harvest_run.returncode != 0:
        raise RuntimeError((harvest_run.stderr or harvest_run.stdout or "Tech-Harvester failed").strip())

    harvest_file = _latest_harvest_file(options.harvest_dir)
    agent_news = build_agent_news(
        report_date=options.report_date,
        harvest_file=harvest_file,
        output_dir=options.temp_dir,
        config_path=options.config_path,
    )
    agent_news_path = options.temp_dir / f"agent_news_{options.report_date}.json"
    report = build_daily_agent_report(
        report_date=options.report_date,
        agent_news_path=agent_news_path,
        output_dir=options.output_dir,
        report_prefix=options.report_prefix,
    )

    return DailyAgentReportPipelineResult(
        success=True,
        message=f"Daily AI agent report generated: {options.report_date}",
        report_date=options.report_date,
        harvest_path=str(harvest_file),
        agent_news_path=str(options.temp_dir / f"agent_news_{options.report_date}.json"),
        report_path=str(options.output_dir / f"{options.report_prefix}-{options.report_date}.md"),
        items_count=agent_news.total_items,
        source_count=agent_news.source_count,
        status="success",
        items=agent_news.items,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the daily AI agent news pipeline.")
    parser.add_argument("--date", dest="report_date", default=date.today().isoformat())
    parser.add_argument("--mode", dest="harvest_mode", default="playwright")
    parser.add_argument("--config", dest="config_path", default="myai/config/sources.json")
    parser.add_argument("--output-dir", dest="output_dir", default="docs")
    parser.add_argument("--temp-dir", dest="temp_dir", default="temp")
    parser.add_argument("--harvest-dir", dest="harvest_dir", default="temp/harvest_results")
    parser.add_argument("--report-prefix", dest="report_prefix", default="002-Napi-AI-Agent-Jelentes")
    args = parser.parse_args()

    options = PipelineOptions(
        report_date=args.report_date,
        harvest_mode=args.harvest_mode,
        config_path=Path(args.config_path),
        output_dir=Path(args.output_dir),
        report_prefix=args.report_prefix,
        harvest_dir=Path(args.harvest_dir),
        temp_dir=Path(args.temp_dir),
    )

    try:
        result = run_daily_agent_report_pipeline(options)
        print(result.model_dump_json(indent=2))
        return 0
    except Exception as error:
        failed = DailyAgentReportPipelineResult(
            success=False,
            message=str(error),
            report_date=options.report_date,
            harvest_path="",
            agent_news_path="",
            report_path="",
            items_count=0,
            source_count=0,
            status="failed",
            items=[],
        )
        print(failed.model_dump_json(indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
