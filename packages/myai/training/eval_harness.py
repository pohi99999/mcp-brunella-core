#!/usr/bin/env python3
"""Deterministic eval harness for Brunella reflex model candidates."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

SCENARIO_DIR = Path(__file__).resolve().parent / "eval_scenarios"
BASELINE_AVG_SCORE = 0.72
PASS_THRESHOLD = 0.72
WARNING_THRESHOLD = 0.68
REGRESSION_FLOOR = -0.03


@dataclass
class EvalHarnessResult:
    result_id: str
    baseline_model: str
    avg_score: float
    regression_delta: float
    scenario_count: int
    gate_status: str
    report_path: str
    markdown_report_path: str
    summary: str


def _load_manifest(artifact_path: Path) -> dict[str, Any]:
    manifest_path = artifact_path / "training_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Training manifest missing: {manifest_path}")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _load_scenarios() -> list[dict[str, Any]]:
    scenarios: list[dict[str, Any]] = []
    for scenario_path in sorted(SCENARIO_DIR.glob("*.json")):
        scenarios.append(json.loads(scenario_path.read_text(encoding="utf-8")))
    if not scenarios:
        raise ValueError("No eval scenarios found")
    return scenarios


def _score_scenario(manifest: dict[str, Any], scenario: dict[str, Any]) -> dict[str, Any]:
    avg_quality = float(manifest.get("avg_quality", 0.0))
    sample_count = int(manifest.get("sample_count", 0))
    dry_run_penalty = 0.05 if manifest.get("dry_run") else 0.0
    coverage = min(sample_count / 40.0, 1.0)
    difficulty = float(scenario.get("difficulty", 0.5))
    weight = float(scenario.get("weight", 1.0))

    score = (avg_quality * 0.62) + (coverage * 0.28) + (weight * 0.05) - (difficulty * 0.1) - dry_run_penalty
    score = max(0.0, min(1.0, round(score, 4)))

    return {
        "id": scenario["id"],
        "category": scenario.get("category"),
        "weight": weight,
        "difficulty": difficulty,
        "score": score,
        "passed": score >= float(scenario.get("min_score", PASS_THRESHOLD)),
    }


def run_eval_harness(artifact_path: str, version: str, eval_root: str, baseline_model: str, run_id: str) -> EvalHarnessResult:
    artifact = Path(artifact_path)
    artifact.mkdir(parents=True, exist_ok=True)
    eval_dir = Path(eval_root)
    eval_dir.mkdir(parents=True, exist_ok=True)

    manifest = _load_manifest(artifact)
    scenarios = _load_scenarios()
    scored = [_score_scenario(manifest, scenario) for scenario in scenarios]

    total_weight = sum(item["weight"] for item in scored) or 1.0
    avg_score = round(sum(item["score"] * item["weight"] for item in scored) / total_weight, 4)
    regression_delta = round(avg_score - BASELINE_AVG_SCORE, 4)

    if avg_score >= PASS_THRESHOLD and regression_delta >= REGRESSION_FLOOR:
        gate_status = "passed"
    elif avg_score >= WARNING_THRESHOLD:
        gate_status = "warning"
    else:
        gate_status = "failed"

    result_id = f"eval_{run_id}"
    created_at = datetime.utcnow().isoformat()
    report_path = eval_dir / f"{result_id}.json"
    markdown_report_path = eval_dir / f"{result_id}.md"
    summary = (
        f"Eval harness {gate_status}: avg score {avg_score:.2f}, "
        f"delta {regression_delta:+.2f}, scenarios {len(scored)}"
    )

    report = {
        "result_id": result_id,
        "version": version,
        "baseline_model": baseline_model,
        "avg_score": avg_score,
        "regression_delta": regression_delta,
        "gate_status": gate_status,
        "scenario_count": len(scored),
        "created_at": created_at,
        "scenarios": scored,
        "manifest": manifest,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    markdown_report_path.write_text(
        "\n".join([
            f"# Eval Report — {version}",
            "",
            f"- Baseline: `{baseline_model}`",
            f"- Avg score: **{avg_score:.2f}**",
            f"- Regression delta: **{regression_delta:+.2f}**",
            f"- Gate status: **{gate_status.upper()}**",
            "",
            "## Scenarios",
            *[
                f"- `{scenario['id']}` ({scenario['category']}): score={scenario['score']:.2f}, passed={'yes' if scenario['passed'] else 'no'}"
                for scenario in scored
            ],
        ]),
        encoding="utf-8",
    )

    return EvalHarnessResult(
        result_id=result_id,
        baseline_model=baseline_model,
        avg_score=avg_score,
        regression_delta=regression_delta,
        scenario_count=len(scored),
        gate_status=gate_status,
        report_path=str(report_path),
        markdown_report_path=str(markdown_report_path),
        summary=summary,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute Brunella eval harness")
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--eval-root", required=True)
    parser.add_argument("--baseline-model", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    result = run_eval_harness(
        artifact_path=args.artifact,
        version=args.version,
        eval_root=args.eval_root,
        baseline_model=args.baseline_model,
        run_id=args.run_id,
    )
    print(json.dumps(asdict(result), ensure_ascii=False))


if __name__ == "__main__":
    main()
