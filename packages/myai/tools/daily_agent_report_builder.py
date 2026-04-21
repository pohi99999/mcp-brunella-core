from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from myai.tools.build_agent_news import AgentNewsDocument, AgentNewsItem


class DailyAgentReportSection(BaseModel):
    title: str
    items: list[AgentNewsItem] = Field(default_factory=list)
    summary: str


class DailyAgentReportDocument(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: str
    generated_at: str
    source_news_path: str
    report_path: str
    sections: list[DailyAgentReportSection]
    items_count: int


SECTION_ORDER = [
    "enterprise",
    "standard",
    "framework",
    "research",
]

SECTION_TITLES = {
    "enterprise": "Mai top hírek / fejlemények",
    "standard": "Szabványok, jog, kockázat",
    "framework": "Framework radar",
    "research": "Inspirációs use case-ek",
}


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_agent_news(agent_news_path: Path) -> AgentNewsDocument:
    return AgentNewsDocument.model_validate_json(agent_news_path.read_text(encoding="utf-8"))


def _group_items(agent_news: AgentNewsDocument) -> dict[str, list[AgentNewsItem]]:
    grouped: dict[str, list[AgentNewsItem]] = {key: [] for key in SECTION_ORDER}
    for item in agent_news.items:
        category = item.category.lower().strip()
        bucket = category if category in grouped else "standard"
        grouped[bucket].append(item)
    return grouped


def _render_items(items: list[AgentNewsItem]) -> str:
    if not items:
        return "- Nincs kiemelt találat ebben a kategóriában."

    lines: list[str] = []
    for idx, item in enumerate(items, start=1):
        lines.append(f"{idx}. **{item.title}**")
        lines.append(f"   - Forrás: {item.source}")
        if item.url:
            lines.append(f"   - Link: {item.url}")
        lines.append(f"   - Röviden: {item.summary}")
    return "\n".join(lines)


def _build_trend_bullets(agent_news: AgentNewsDocument) -> list[str]:
    framework_count = sum(1 for item in agent_news.items if item.category == "framework")
    standard_count = sum(1 for item in agent_news.items if item.category == "standard")
    research_count = sum(1 for item in agent_news.items if item.category == "research")

    bullets = [
        f"A napi szűrés {agent_news.total_items} releváns agent hírt emelt ki {agent_news.source_count} forrásból.",
        f"A framework fókusz {framework_count} találatot hozott, ezeket érdemes külön trackként nézni.",
        f"A szabvány / kockázat oldal {standard_count} jelzést adott, a kutatási inspirációs oldal pedig {research_count} elemet.",
    ]
    return bullets


def _build_brunella_actions(agent_news: AgentNewsDocument) -> list[str]:
    actions: list[str] = []
    if any(item.category == "framework" for item in agent_news.items):
        actions.append("Készíts külön Brunella tracket a legígéretesebb framework integrációhoz.")
    if any(item.category == "standard" for item in agent_news.items):
        actions.append("Ellenőrizd, kell-e guardrail vagy compliance frissítés a nyelvi modell hívásokhoz.")
    if any(item.category == "research" for item in agent_news.items):
        actions.append("Tegyél be egy rövid proof-of-concept kísérletet a legérdekesebb kutatási mintára.")
    if not actions:
        actions.append("Nincs kiemelt akció: a mai minta inkább monitorozásra alkalmas.")
    return actions[:3]


def build_daily_agent_report(
    *,
    report_date: str,
    agent_news_path: Path,
    output_dir: Path | None = None,
    report_prefix: str = "002-Napi-AI-Agent-Jelentes",
) -> DailyAgentReportDocument:
    root = _root()
    output_dir = output_dir or root / "docs"
    output_dir.mkdir(parents=True, exist_ok=True)

    agent_news = _load_agent_news(agent_news_path)
    grouped = _group_items(agent_news)
    sections: list[DailyAgentReportSection] = []

    sections.append(
        DailyAgentReportSection(
            title="Trendkép – hol tartanak az ügynökök",
            items=[],
            summary="\n".join(f"- {bullet}" for bullet in _build_trend_bullets(agent_news)),
        )
    )

    for category in SECTION_ORDER:
        items = grouped.get(category, [])
        sections.append(
            DailyAgentReportSection(
                title=SECTION_TITLES[category],
                items=items,
                summary=_render_items(items),
            )
        )

    sections.append(
        DailyAgentReportSection(
            title="Brunella-specifikus javaslatok mára",
            items=[],
            summary="\n".join(f"- {action}" for action in _build_brunella_actions(agent_news)),
        )
    )

    report_path = output_dir / f"{report_prefix}-{report_date}.md"
    front_matter = [
        "---",
        f"title: {json.dumps(f'Napi AI Agent Jelentés – {report_date}')}",
        f"date: {json.dumps(report_date)}",
        f"generatedAt: {json.dumps(datetime.utcnow().isoformat())}",
        f"generatedBy: {json.dumps('DailyAgentReportBuilder')}",
        f"reportType: {json.dumps('daily_agent_report')}",
        f"sourceNewsPath: {json.dumps(str(agent_news_path))}",
        f"reportPath: {json.dumps(str(report_path))}",
        "---",
    ]

    body: list[str] = [
        f"# Napi AI Agent Jelentés – {report_date}",
        "",
    ]

    for section in sections:
        body.append(f"## {section.title}")
        body.append("")
        body.append(section.summary)
        body.append("")

    content = "\n".join(front_matter + [""] + body).strip() + "\n"
    report_path.write_text(content, encoding="utf-8")

    return DailyAgentReportDocument(
        date=report_date,
        generated_at=datetime.utcnow().isoformat(),
        source_news_path=str(agent_news_path),
        report_path=str(report_path),
        sections=sections,
        items_count=agent_news.total_items,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the daily AI agent markdown report.")
    parser.add_argument("--date", dest="report_date", required=True)
    parser.add_argument("--agent-news-path", dest="agent_news_path", required=True)
    parser.add_argument("--output-dir", dest="output_dir", default=None)
    parser.add_argument("--report-prefix", dest="report_prefix", default="002-Napi-AI-Agent-Jelentes")
    args = parser.parse_args()

    output_dir = Path(args.output_dir) if args.output_dir else None
    document = build_daily_agent_report(
        report_date=args.report_date,
        agent_news_path=Path(args.agent_news_path),
        output_dir=output_dir,
        report_prefix=args.report_prefix,
    )
    print(document.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
