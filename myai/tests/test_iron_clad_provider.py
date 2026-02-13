from __future__ import annotations

from unittest.mock import MagicMock

from myai.backend.config import BackendConfig
from myai.backend.providers import CompletionResult, IronCladProviderGateway
from myai.backend.schemas import ChatMessage


def make_config(**overrides: object) -> BackendConfig:
    base_kwargs = {
        "ollama_base_url": "http://localhost:11434",
        "default_model": "qwen2.5-coder:latest",
        "backend_name": "iron",
        "vllm_base_url": "http://localhost:8001",
        "high_capacity_models": ("mega-coder",),
    }
    base_kwargs.update(overrides)
    return BackendConfig(**base_kwargs)  # type: ignore[arg-type]


def make_messages() -> list[ChatMessage]:
    return [ChatMessage(role="user", content="Hello there")]


def make_completion() -> CompletionResult:
    return CompletionResult(content="response", usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2})


def test_high_capacity_model_prefers_vllm():
    gateway = IronCladProviderGateway(make_config())
    gateway._try_vllm = MagicMock(return_value=make_completion())  # type: ignore[attr-defined]
    gateway._try_litellm = MagicMock(return_value=None)  # type: ignore[attr-defined]
    gateway._ollama_fallback = MagicMock(return_value=None)  # type: ignore[attr-defined]

    gateway.complete_chat(model="mega-coder", messages=make_messages())

    gateway._try_vllm.assert_called_once()
    gateway._try_litellm.assert_not_called()
    gateway._ollama_fallback.assert_not_called()


def test_vllm_failure_falls_back_to_litellm():
    gateway = IronCladProviderGateway(make_config())
    gateway._try_vllm = MagicMock(return_value=None)  # type: ignore[attr-defined]
    gateway._try_litellm = MagicMock(return_value=make_completion())  # type: ignore[attr-defined]
    gateway._ollama_fallback = MagicMock(return_value=None)  # type: ignore[attr-defined]

    result = gateway.complete_chat(model="mega-coder", messages=make_messages())

    gateway._try_vllm.assert_called_once()
    gateway._try_litellm.assert_called_once()
    assert result.content == "response"


def test_small_model_skips_vllm_path():
    gateway = IronCladProviderGateway(make_config())
    gateway._try_vllm = MagicMock(return_value=None)  # type: ignore[attr-defined]
    gateway._try_litellm = MagicMock(return_value=make_completion())  # type: ignore[attr-defined]

    gateway.complete_chat(model="mini-coder", messages=make_messages())

    gateway._try_vllm.assert_not_called()
    gateway._try_litellm.assert_called_once()
