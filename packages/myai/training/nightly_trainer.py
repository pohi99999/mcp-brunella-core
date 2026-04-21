#!/usr/bin/env python3
"""Dry-run friendly nightly trainer for Brunella Learning Loop."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class NightlyTrainingResult:
    run_id: str
    version: str
    display_name: str
    artifact_path: str
    provider: str
    model_name: str
    sample_count: int
    avg_quality: float
    summary: str
    created_at: str
    dry_run: bool


def _count_snapshot(snapshot_path: Path) -> tuple[int, float]:
    count = 0
    qualities: list[float] = []
    with snapshot_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            metadata = row.get("metadata") or {}
            qualities.append(float(metadata.get("quality", 0.0)))
            count += 1
    if count == 0:
        raise ValueError("Snapshot is empty")
    avg_quality = sum(qualities) / len(qualities) if qualities else 0.0
    return count, avg_quality


def run_nightly_training(snapshot_path: str, artifact_root: str, run_id: str, model_name: str, dry_run: bool = True) -> NightlyTrainingResult:
    snapshot = Path(snapshot_path)
    if not snapshot.exists():
        raise FileNotFoundError(f"Snapshot not found: {snapshot}")

    sample_count, avg_quality = _count_snapshot(snapshot)
    version = f"{model_name}-{run_id}"
    artifact_dir = Path(artifact_root) / version
    artifact_dir.mkdir(parents=True, exist_ok=True)

    created_at = datetime.utcnow().isoformat()
    manifest = {
        "run_id": run_id,
        "version": version,
        "model_name": model_name,
        "provider": "ollama",
        "snapshot_path": str(snapshot),
        "artifact_path": str(artifact_dir),
        "sample_count": sample_count,
        "avg_quality": avg_quality,
        "dry_run": dry_run,
        "created_at": created_at,
        "summary": "Dry-run nightly training artifact prepared" if dry_run else "Nightly training artifact prepared",
    }
    (artifact_dir / "training_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (artifact_dir / "adapter_config.json").write_text(json.dumps({
        "base_model": model_name,
        "sample_count": sample_count,
        "avg_quality": avg_quality,
        "mode": "dry_run" if dry_run else "prepared",
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = (
        f"Nightly trainer {'dry-run' if dry_run else 'prepared'}: {sample_count} samples, "
        f"avg quality {avg_quality:.2f}, artifact {artifact_dir.name}"
    )

    return NightlyTrainingResult(
        run_id=run_id,
        version=version,
        display_name=f"Brunella Reflex {version}",
        artifact_path=str(artifact_dir),
        provider="ollama",
        model_name=version,
        sample_count=sample_count,
        avg_quality=avg_quality,
        summary=summary,
        created_at=created_at,
        dry_run=dry_run,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute Brunella nightly trainer")
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--artifact-root", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = run_nightly_training(
        snapshot_path=args.snapshot,
        artifact_root=args.artifact_root,
        run_id=args.run_id,
        model_name=args.model_name,
        dry_run=args.dry_run,
    )
    print(json.dumps(asdict(result), ensure_ascii=False))


if __name__ == "__main__":
    main()
