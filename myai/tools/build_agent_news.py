from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_AGENT_KEYWORDS = [
    "ai agent",
    "agentic ai",
    "multi-agent",
    "multi agent",
    "langgraph",
    "crewai",
    "openai agents",
    "google adk",
    "model context protocol",
    "mcp",
]

SECTION_KEYWORDS = {
    "framework": ["langgraph", "crewai", "framework", "sdk", "agents sdk", "mcp server"],
    "standard": ["nist", "eu ai act", "compliance", "policy", "standard", "governance", "security"],
    "enterprise": ["enterprise", "production", "launch", "vendor", "customer", "workflow"],
}


class HarvestItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str | None = None
    summary: str | None = None
    content: str | None = None
    description: str | None = None
    url: str | None = None
    source: str | None = None
    type: str | None = None
    timestamp: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)


class HarvestDocument(BaseModel):
    model_config = ConfigDict(extra="allow")

    harvested_at: str
    total_items: int = 0
    sources: list[str] = Field(default_factory=list)
    items: list[HarvestItem] = Field(default_factory=list)


class AgentNewsItem(BaseModel):
    title: str
    url: str | None = None
    summary: str
    source: str
    category: str


class AgentNewsDocument(BaseModel):
    date: str
    generated_at: str
    source_file: str
    total_items: int
    source_count: int
    items: list[AgentNewsItem]


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _extract_text(item: HarvestItem) -> str:
    parts: list[str] = []
    for field in (item.title, item.summary, item.content, item.description, item.url, item.source, item.type, item.category):
        if isinstance(field, str) and field.strip():
            parts.append(field)
    for tag in item.tags:
        if isinstance(tag, str) and tag.strip():
            parts.append(tag)
    for key, value in item.model_dump(exclude_none=True).items():
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, list):
            parts.extend(str(entry) for entry in value if isinstance(entry, str))
    return _normalize_text(" ".join(parts))


def _matches_keywords(text: str, keywords: list[str]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def _classify_category(item: HarvestItem, text: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in SECTION_KEYWORDS["framework"]):
        return "framework"
    if any(keyword in lowered for keyword in SECTION_KEYWORDS["standard"]):
        return "standard"
    if any(keyword in lowered for keyword in SECTION_KEYWORDS["enterprise"]):
        return "enterprise"
    if any(token in lowered for token in ["research", "paper", "benchmark", "evaluation", "analysis", "use case"]):
        return "research"
    if isinstance(item.category, str) and item.category.strip():
        return item.category.strip().lower()
    return "standard"


def _summarize(item: HarvestItem) -> str:
    for value in (item.summary, item.content, item.description):
        if isinstance(value, str) and value.strip():
            text = _normalize_text(value)
            return text[:320] + ("..." if len(text) > 320 else "")
    return "Rövid kivonat nem volt elérhető."


def _candidate_harvest_files(harvest_dir: Path) -> list[Path]:
    return sorted(harvest_dir.glob("harvest_results_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)


def _load_config_keywords(config_path: Path | None) -> list[str]:
    if config_path is None or not config_path.exists():
        return []
    data = json.loads(config_path.read_text(encoding="utf-8"))
    keywords: list[str] = []
    for key in ("agentKeywords", "globalKeywords"):
        values = data.get(key)
        if isinstance(values, list):
            keywords.extend(str(item) for item in values if isinstance(item, str))
    return keywords


def _load_harvest_document(harvest_file: Path) -> HarvestDocument:
    payload = json.loads(harvest_file.read_text(encoding="utf-8"))
    items = payload.get("items", []) if isinstance(payload, dict) else []
    sources = payload.get("sources", []) if isinstance(payload, dict) else []
    harvested_at = payload.get("harvested_at") if isinstance(payload, dict) else None
    return HarvestDocument(
        harvested_at=str(harvested_at or datetime.utcnow().isoformat()),
        total_items=int(payload.get("total_items") or len(items)) if isinstance(payload, dict) else len(items),
        sources=[str(source) for source in sources if isinstance(source, str)],
        items=[HarvestItem.model_validate(item) for item in items if isinstance(item, dict)],
    )


def build_agent_news(
    *,
    report_date: str | None = None,
    harvest_file: Path | None = None,
    harvest_dir: Path | None = None,
    output_dir: Path | None = None,
    config_path: Path | None = None,
    keywords: list[str] | None = None,
) -> AgentNewsDocument:
    root = _root()
    harvest_dir = harvest_dir or root / "temp" / "harvest_results"
    output_dir = output_dir or root / "temp"
    output_dir.mkdir(parents=True, exist_ok=True)

    report_date = report_date or date.today().isoformat()
    candidate_file = harvest_file
    if candidate_file is None:
        candidates = _candidate_harvest_files(harvest_dir)
        if not candidates:
            raise FileNotFoundError(f"No harvest_results_*.json files found in {harvest_dir}")
        candidate_file = candidates[0]

    harvest = _load_harvest_document(candidate_file)
    keyword_pool = list(DEFAULT_AGENT_KEYWORDS)
    keyword_pool.extend(_load_config_keywords(config_path))
    if keywords:
        keyword_pool.extend(keywords)

    seen: set[str] = set()
    items: list[AgentNewsItem] = []
    for item in harvest.items:
        text = _extract_text(item)
        if not _matches_keywords(text, keyword_pool):
            continue

        title = item.title.strip() if isinstance(item.title, str) and item.title.strip() else (item.source or "Untitled source")
        url = item.url.strip() if isinstance(item.url, str) and item.url.strip() else None
        key = url or title.lower()
        if key in seen:
            continue
        seen.add(key)

        items.append(
            AgentNewsItem(
                title=title,
                url=url,
                summary=_summarize(item),
                source=item.source.strip() if isinstance(item.source, str) and item.source.strip() else "unknown",
                category=_classify_category(item, text),
            )
        )

    document = AgentNewsDocument(
        date=report_date,
        generated_at=datetime.utcnow().isoformat(),
        source_file=str(candidate_file),
        total_items=len(items),
        source_count=len(harvest.sources),
        items=items,
    )

    output_path = output_dir / f"agent_news_{report_date}.json"
    output_path.write_text(document.model_dump_json(indent=2), encoding="utf-8")
    return document


def main() -> int:
    parser = argparse.ArgumentParser(description="Build normalized agent news from Tech-Harvester output.")
    parser.add_argument("--date", dest="report_date", default=None)
    parser.add_argument("--harvest-file", dest="harvest_file", default=None)
    parser.add_argument("--harvest-dir", dest="harvest_dir", default=None)
    parser.add_argument("--output-dir", dest="output_dir", default=None)
    parser.add_argument("--config", dest="config_path", default=None)
    args = parser.parse_args()

    harvest_file = Path(args.harvest_file) if args.harvest_file else None
    harvest_dir = Path(args.harvest_dir) if args.harvest_dir else None
    output_dir = Path(args.output_dir) if args.output_dir else None
    config_path = Path(args.config_path) if args.config_path else None

    document = build_agent_news(
        report_date=args.report_date,
        harvest_file=harvest_file,
        harvest_dir=harvest_dir,
        output_dir=output_dir,
        config_path=config_path,
    )

    print(document.model_dump_json(indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
