from __future__ import annotations

from dataclasses import replace
from typing import cast

import pytest

from myai.backend.autogen_adapter import AutoGenAdapter, ProviderPreference
from myai.backend.config import BackendConfig


def make_config(**overrides: object) -> BackendConfig:
    base_config = BackendConfig(
        ollama_base_url="http://localhost:11434",
        default_model="qwen2.5-coder:latest",
        backend_name="iron",
        vllm_base_url=None,
        high_capacity_models=("mega-coder",),
        gateway_base_url="http://127.0.0.1:8010",
        interpreter_enabled=False,
        interpreter_auto_run=False,
        interpreter_system_message=None,
        interpreter_allowed_modes=("python",),
        interpreter_max_chars=4000,
        opendevin_enabled=False,
        opendevin_mode="http",
        opendevin_base_url=None,
        opendevin_cli_command=None,
        opendevin_project_root=None,
        opendevin_model_endpoint="http://127.0.0.1:8010",
        opendevin_timeout=300,
        opendevin_max_chars=8000,
    )
    return replace(base_config, **overrides)


class FakeMessage:
    def __init__(self, content: object):
        self.content = content


class FakeTaskResult:
    def __init__(self, messages: list[FakeMessage], stop_reason: str | None = None):
        self.messages = messages
        self.stop_reason = stop_reason


class FakeClient:
    def __init__(self, *, close_error: Exception | None = None):
        self.closed = False
        self.close_error = close_error

    async def close(self) -> None:
        self.closed = True
        if self.close_error is not None:
            raise self.close_error


class FakeAgent:
    def __init__(self, result: FakeTaskResult | None = None, error: Exception | None = None):
        self._result = result or FakeTaskResult([FakeMessage("ok")])
        self._error = error
        self.last_task: str | None = None

    async def run(self, *, task: str):
        self.last_task = task
        if self._error is not None:
            raise self._error
        return self._result


class RecordingAutoGenAdapter(AutoGenAdapter):
    def __init__(self, config: BackendConfig, **kwargs: object):
        super().__init__(config, **kwargs)
        self.client = FakeClient()
        self.agent = FakeAgent()
        self.last_provider: str | None = None
        self.last_model: str | None = None
        self.system_messages: list[str | None] = []

    def _build_client(self, provider: str, model: str):
        self.last_provider = provider
        self.last_model = model
        return self.client

    def _create_agent(self, client: object, system_message: str | None):
        self.system_messages.append(system_message)
        return self.agent


class ProviderAwareAutoGenAdapter(AutoGenAdapter):
    def __init__(self, config: BackendConfig, **kwargs: object):
        super().__init__(config, **kwargs)
        self.last_provider: str | None = None
        self.last_model: str | None = None
        self.clients = {
            "github": FakeClient(),
            "ollama": FakeClient(),
        }
        self.agents = {
            "github": FakeAgent(),
            "ollama": FakeAgent(),
        }

    def _build_client(self, provider: str, model: str):
        self.last_provider = provider
        self.last_model = model
        return self.clients[provider]

    def _create_agent(self, client: object, system_message: str | None):
        if client is self.clients["github"]:
            return self.agents["github"]
        return self.agents["ollama"]


def test_resolve_provider_prefers_github_when_token_present():
    adapter = AutoGenAdapter(make_config(), github_token="ghp_test")
    assert adapter.resolve_provider("auto") == "github"


def test_resolve_provider_falls_back_to_ollama_without_token():
    adapter = AutoGenAdapter(make_config(), github_token=None)
    assert adapter.resolve_provider("auto") == "ollama"


def test_resolve_provider_github_without_token_raises():
    adapter = AutoGenAdapter(make_config(), github_token=None)
    with pytest.raises(RuntimeError, match="GITHUB_PAT or GITHUB_TOKEN"):
        adapter.resolve_provider("github")


def test_resolve_provider_invalid_preference_raises():
    adapter = AutoGenAdapter(make_config(), github_token="ghp_test")
    with pytest.raises(RuntimeError, match="Unsupported provider preference"):
        adapter.resolve_provider(cast(ProviderPreference, "invalid"))


@pytest.mark.asyncio
async def test_run_uses_github_by_default_when_token_present():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agent = FakeAgent(
        FakeTaskResult([FakeMessage("Hello from GitHub Models")], stop_reason="done")
    )

    result = await adapter.run("Summarize this")

    assert adapter.last_provider == "github"
    assert result.provider == "github"
    assert result.output == "Hello from GitHub Models"
    assert result.stop_reason == "done"
    assert adapter.client.closed is True


@pytest.mark.asyncio
async def test_run_falls_back_to_ollama_when_no_github_token():
    adapter = RecordingAutoGenAdapter(make_config(), github_token=None)
    adapter.agent = FakeAgent(FakeTaskResult([FakeMessage("Local answer")]))

    result = await adapter.run("Summarize this")

    assert adapter.last_provider == "ollama"
    assert result.provider == "ollama"
    assert result.model == "qwen2.5-coder:latest"
    assert result.output == "Local answer"


@pytest.mark.asyncio
async def test_run_closes_client_on_agent_error():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agent = FakeAgent(error=RuntimeError("boom"))

    with pytest.raises(RuntimeError, match="boom"):
        await adapter.run("Trigger failure")

    assert adapter.client.closed is True


@pytest.mark.asyncio
async def test_run_rejects_empty_task():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    with pytest.raises(RuntimeError, match="Task cannot be empty"):
        await adapter.run("   ")


@pytest.mark.asyncio
async def test_run_rejects_task_above_max_chars():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test", max_chars=5)
    with pytest.raises(RuntimeError, match="Task too long"):
        await adapter.run("123456")


@pytest.mark.asyncio
async def test_run_uses_explicit_model_override():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agent = FakeAgent(FakeTaskResult([FakeMessage("override ok")]))

    result = await adapter.run("Summarize this", model="openai/gpt-5-chat")

    assert adapter.last_model == "openai/gpt-5-chat"
    assert result.model == "openai/gpt-5-chat"


@pytest.mark.asyncio
async def test_run_falls_back_to_ollama_when_github_runtime_fails_in_auto_mode():
    adapter = ProviderAwareAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agents["github"] = FakeAgent(error=RuntimeError("github down"))
    adapter.agents["ollama"] = FakeAgent(FakeTaskResult([FakeMessage("ollama fallback")]))

    result = await adapter.run("Summarize this", prefer_provider="auto")

    assert result.provider == "ollama"
    assert result.output == "ollama fallback"
    assert adapter.clients["github"].closed is True
    assert adapter.clients["ollama"].closed is True


@pytest.mark.asyncio
async def test_run_stringifies_structured_content():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agent = FakeAgent(FakeTaskResult([FakeMessage({"answer": "ok"})]))

    result = await adapter.run("Summarize this")

    assert result.output == '{"answer": "ok"}'


@pytest.mark.asyncio
async def test_run_returns_zero_message_count_when_messages_missing():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.agent = FakeAgent(FakeTaskResult([]))

    result = await adapter.run("Summarize this")

    assert result.message_count == 0
    assert result.output == ""


@pytest.mark.asyncio
async def test_close_error_does_not_mask_primary_error():
    adapter = RecordingAutoGenAdapter(make_config(), github_token="ghp_test")
    adapter.client = FakeClient(close_error=RuntimeError("close failed"))
    adapter.agent = FakeAgent(error=RuntimeError("primary failed"))

    with pytest.raises(RuntimeError, match="primary failed"):
        await adapter.run("Summarize this")

    assert adapter.client.closed is True