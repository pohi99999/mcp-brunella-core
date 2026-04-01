from __future__ import annotations

import json

import pytest

from myai.backend.autogen_adapter import AutoGenRunResult
from myai import mcp_server


class FakeAdapter:
    def __init__(self):
        self.calls: list[dict[str, str | None]] = []

    async def run(
        self,
        task: str,
        *,
        system_message: str | None = None,
        prefer_provider: str = "auto",
        model: str | None = None,
    ) -> AutoGenRunResult:
        self.calls.append(
            {
                "task": task,
                "system_message": system_message,
                "prefer_provider": prefer_provider,
                "model": model,
            }
        )
        return AutoGenRunResult(
            provider="github",
            model=model or "openai/gpt-5-mini",
            output=f"handled:{task}",
            stop_reason="done",
            message_count=1,
        )


class FailingAdapter:
    async def run(
        self,
        task: str,
        *,
        system_message: str | None = None,
        prefer_provider: str = "auto",
        model: str | None = None,
    ) -> AutoGenRunResult:
        raise RuntimeError("adapter failed")


class FailingFactory:
    def __call__(self):
        raise RuntimeError("factory failed")


@pytest.mark.asyncio
async def test_autogen_run_task_returns_success_payload(monkeypatch: pytest.MonkeyPatch):
    adapter = FakeAdapter()
    monkeypatch.setattr(mcp_server, "_get_autogen_adapter", lambda: adapter)

    raw = await mcp_server.autogen_run_task(
        "write a summary",
        system_message="be concise",
        prefer_provider="github",
        model="openai/gpt-5-mini",
    )
    payload = json.loads(raw)

    assert payload["status"] == "success"
    assert payload["provider"] == "github"
    assert payload["model"] == "openai/gpt-5-mini"
    assert payload["output"] == "handled:write a summary"
    assert payload["message_count"] == 1
    assert adapter.calls == [
        {
            "task": "write a summary",
            "system_message": "be concise",
            "prefer_provider": "github",
            "model": "openai/gpt-5-mini",
        }
    ]


@pytest.mark.asyncio
async def test_autogen_run_task_returns_error_payload(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(mcp_server, "_get_autogen_adapter", lambda: FailingAdapter())

    raw = await mcp_server.autogen_run_task("write a summary")
    payload = json.loads(raw)

    assert payload["status"] == "error"
    assert "adapter failed" in payload["error"]


@pytest.mark.asyncio
async def test_autogen_run_task_returns_error_when_factory_raises(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(mcp_server, "_get_autogen_adapter", FailingFactory())

    raw = await mcp_server.autogen_run_task("write a summary")
    payload = json.loads(raw)

    assert payload["status"] == "error"
    assert "factory failed" in payload["error"]


def test_system_health_reports_autogen_readiness_keys():
    payload = json.loads(mcp_server.system_health())
    capabilities = payload["capabilities"]

    assert "autogen_pilot" in capabilities
    assert "autogen_ollama_ready" in capabilities
    assert "autogen_github_ready" in capabilities
    assert "github_models_token" in capabilities