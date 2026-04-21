from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

from myai import mcp_server


class _FailingRagService:
    async def search(self, query: str, limit: int) -> list[dict[str, Any]]:
        raise RuntimeError("search backend unavailable")


@pytest.mark.asyncio
async def test_rag_search_returns_import_error_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_import_error() -> object:
        raise ImportError("missing lancedb")

    monkeypatch.setattr(mcp_server, "_get_rag", raise_import_error)

    payload = json.loads(await mcp_server.rag_search("security", limit=7))

    assert payload == {
        "status": "error",
        "error": "lancedb not installed — RAG unavailable",
    }


@pytest.mark.asyncio
async def test_rag_search_returns_error_payload_when_search_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(mcp_server, "_get_rag", lambda: _FailingRagService())

    payload = json.loads(await mcp_server.rag_search("security", limit=3))

    assert payload["status"] == "error"
    assert payload["error"] == "search backend unavailable"


@pytest.mark.asyncio
async def test_harvest_scenario_rejects_path_traversal_before_worker_execution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker_called = False

    async def fake_run_scenario(path: str, force_mode: str | None = None) -> dict[str, str]:
        nonlocal worker_called
        worker_called = True
        return {"path": path, "force_mode": force_mode or "auto"}

    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_scenario=fake_run_scenario),
    )

    payload = json.loads(await mcp_server.harvest_scenario("../secrets.json"))

    assert payload["status"] == "error"
    assert payload["error"] == "Scenario path must stay within myai/scenarios"
    assert worker_called is False


@pytest.mark.asyncio
async def test_harvest_scenario_rejects_non_json_scenario_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker_called = False

    async def fake_run_scenario(path: str, force_mode: str | None = None) -> dict[str, str]:
        nonlocal worker_called
        worker_called = True
        return {"path": path, "force_mode": force_mode or "auto"}

    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_scenario=fake_run_scenario),
    )

    payload = json.loads(await mcp_server.harvest_scenario("myai/scenarios/scenario.txt"))

    assert payload["status"] == "error"
    assert payload["error"] == "Scenario path must point to a JSON file"
    assert worker_called is False


@pytest.mark.asyncio
async def test_harvest_scenario_uses_resolved_safe_path_for_valid_relative_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    async def fake_run_scenario(path: str, force_mode: str | None = None) -> dict[str, str | None]:
        captured["path"] = path
        captured["force_mode"] = force_mode
        return {"executed": "yes"}

    safe_path = Path(mcp_server.PROJECT_ROOT_REALPATH) / "myai" / "scenarios" / "safe.json"
    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_scenario=fake_run_scenario),
    )
    monkeypatch.setattr(mcp_server.os.path, "exists", lambda path: path == str(safe_path))

    payload = json.loads(
        await mcp_server.harvest_scenario("myai/scenarios/safe.json", force_mode="api")
    )

    assert payload["status"] == "success"
    assert payload["result"] == {"executed": "yes"}
    assert captured == {"path": str(safe_path), "force_mode": "api"}


@pytest.mark.asyncio
async def test_harvest_extract_rejects_out_of_root_schema_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker_called = False

    async def fake_run_structured_extraction(
        config: dict[str, Any],
        schema_source: str,
    ) -> dict[str, Any]:
        nonlocal worker_called
        worker_called = True
        return {"config": config, "schema_source": schema_source}

    outside_schema = Path(mcp_server.PROJECT_ROOT_REALPATH).parent / "outside-schema.json"
    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_structured_extraction=fake_run_structured_extraction),
    )

    payload = json.loads(
        await mcp_server.harvest_extract("https://example.com", str(outside_schema))
    )

    assert payload["status"] == "error"
    assert payload["error"] == "Schema path must stay within the project root"
    assert worker_called is False


@pytest.mark.asyncio
async def test_harvest_extract_rejects_non_json_schema_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker_called = False

    async def fake_run_structured_extraction(
        config: dict[str, Any],
        schema_source: str,
    ) -> dict[str, Any]:
        nonlocal worker_called
        worker_called = True
        return {"config": config, "schema_source": schema_source}

    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_structured_extraction=fake_run_structured_extraction),
    )

    payload = json.loads(
        await mcp_server.harvest_extract(
            "https://example.com",
            "myai/scenarios/schema.txt",
        )
    )

    assert payload["status"] == "error"
    assert payload["error"] == "Schema path must point to a JSON file"
    assert worker_called is False


@pytest.mark.asyncio
async def test_harvest_extract_passes_inline_json_schema_to_worker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    inline_schema = '{"type":"object","properties":{"title":{"type":"string"}}}'

    async def fake_run_structured_extraction(
        config: dict[str, Any],
        schema_source: str,
    ) -> dict[str, Any]:
        captured["config"] = config
        captured["schema_source"] = schema_source
        return {"data": {"title": "Example"}}

    monkeypatch.setitem(
        sys.modules,
        "myai.browser_worker",
        types.SimpleNamespace(run_structured_extraction=fake_run_structured_extraction),
    )

    payload = json.loads(
        await mcp_server.harvest_extract(
            "https://example.com",
            inline_schema,
            extraction_prompt="Extract title",
            model="gemini-test",
        )
    )

    assert payload == {"status": "success", "data": {"title": "Example"}}
    assert captured == {
        "config": {
            "target_url": "https://example.com",
            "extraction_prompt": "Extract title",
            "model": "gemini-test",
        },
        "schema_source": inline_schema,
    }
