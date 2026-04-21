#!/usr/bin/env python3
"""Create curated Learning Loop snapshots from approved golden dataset rows."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

DEFAULT_SYSTEM_PROMPT = "You are Brunella Reflex, a task-specialized local helper model."


@dataclass
class SnapshotResult:
    snapshot_id: str
    snapshot_path: str
    metadata_path: str
    sample_count: int
    avg_quality: float
    created_at: str


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _to_chatml_entry(sample: dict[str, Any]) -> dict[str, Any]:
    provenance = sample.get("provenance") or {}
    system_prompt = provenance.get("systemPrompt") if isinstance(provenance, dict) else None
    if not isinstance(system_prompt, str) or not system_prompt.strip():
        system_prompt = DEFAULT_SYSTEM_PROMPT

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": sample["prompt"]},
            {"role": "assistant", "content": sample["completion"]},
        ],
        "metadata": {
            "candidateId": sample.get("id"),
            "source": sample.get("source"),
            "quality": sample.get("quality"),
            "approvalState": sample.get("approvalState"),
            "piiRedactedCount": sample.get("piiRedactedCount", 0),
            "provenance": provenance,
            "createdAt": sample.get("createdAt"),
            "approvedAt": sample.get("approvedAt"),
        },
    }


def create_curated_snapshot(source_path: str, output_dir: str, min_quality: float = 0.7, snapshot_id: str | None = None) -> SnapshotResult:
    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(f"Source dataset not found: {source}")

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    rows = _load_jsonl(source)
    approved = [row for row in rows if row.get("approvalState") == "approved" and float(row.get("quality", 0)) >= min_quality]
    if not approved:
        raise ValueError("No approved rows available for snapshot generation")

    snapshot_id = snapshot_id or f"snapshot_{int(datetime.utcnow().timestamp())}"
    snapshot_path = output / f"{snapshot_id}.jsonl"
    metadata_path = output / f"{snapshot_id}.meta.json"

    entries = [_to_chatml_entry(row) for row in approved]
    with snapshot_path.open("w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")

    avg_quality = sum(float(row.get("quality", 0)) for row in approved) / len(approved)
    created_at = datetime.utcnow().isoformat()
    metadata = {
        "snapshot_id": snapshot_id,
        "sample_count": len(approved),
        "avg_quality": avg_quality,
        "created_at": created_at,
        "source_path": str(source),
        "min_quality": min_quality,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    return SnapshotResult(
        snapshot_id=snapshot_id,
        snapshot_path=str(snapshot_path),
        metadata_path=str(metadata_path),
        sample_count=len(approved),
        avg_quality=avg_quality,
        created_at=created_at,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Create curated training snapshot")
    parser.add_argument("--source", required=True, help="Approved curated dataset JSONL path")
    parser.add_argument("--output-dir", required=True, help="Snapshot output directory")
    parser.add_argument("--min-quality", type=float, default=0.7)
    parser.add_argument("--snapshot-id")
    args = parser.parse_args()

    result = create_curated_snapshot(
        source_path=args.source,
        output_dir=args.output_dir,
        min_quality=args.min_quality,
        snapshot_id=args.snapshot_id,
    )
    print(json.dumps(asdict(result), ensure_ascii=False))


if __name__ == "__main__":
    main()
