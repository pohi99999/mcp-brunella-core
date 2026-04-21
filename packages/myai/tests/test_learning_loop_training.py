import json
from pathlib import Path

from myai.training.dataset_curator import create_curated_snapshot
from myai.training.eval_harness import run_eval_harness
from myai.training.nightly_trainer import run_nightly_training


def test_learning_loop_training_pipeline(tmp_path):
    source_path = tmp_path / "approved.jsonl"
    source_rows = [
        {
            "id": "curated_1",
            "prompt": "Implement a logger wrapper",
            "completion": "Use structured logger helpers and avoid console.log.",
            "source": "Developer",
            "quality": 0.86,
            "approvalState": "approved",
            "piiRedactedCount": 0,
            "provenance": {"sourceType": "reflection"},
            "createdAt": "2026-03-29T00:00:00Z",
            "approvedAt": "2026-03-29T00:10:00Z",
        },
        {
            "id": "curated_2",
            "prompt": "Review route registration",
            "completion": "Check index.ts and register new routes centrally.",
            "source": "evaluator",
            "quality": 0.83,
            "approvalState": "approved",
            "piiRedactedCount": 1,
            "provenance": {"sourceType": "tool_run"},
            "createdAt": "2026-03-29T01:00:00Z",
            "approvedAt": "2026-03-29T01:10:00Z",
        },
    ]
    source_path.write_text("\n".join(json.dumps(row) for row in source_rows) + "\n", encoding="utf-8")

    snapshot = create_curated_snapshot(str(source_path), str(tmp_path / "snapshots"), snapshot_id="snapshot_test")
    assert snapshot.sample_count == 2
    assert Path(snapshot.snapshot_path).exists()

    training = run_nightly_training(snapshot.snapshot_path, str(tmp_path / "artifacts"), "run_001", "brunella-reflex", dry_run=True)
    assert training.sample_count == 2
    assert Path(training.artifact_path, "training_manifest.json").exists()

    evaluation = run_eval_harness(training.artifact_path, training.version, str(tmp_path / "evals"), "qwen2.5-coder:7b", "run_001")
    assert evaluation.scenario_count >= 4
    assert evaluation.gate_status in {"passed", "warning", "failed"}
    assert Path(evaluation.report_path).exists()
    assert Path(evaluation.markdown_report_path).exists()
