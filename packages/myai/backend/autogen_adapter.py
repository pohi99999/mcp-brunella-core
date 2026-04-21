from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
from dataclasses import dataclass
from typing import Literal

from .config import BackendConfig

ProviderPreference = Literal["auto", "github", "ollama"]
ResolvedProvider = Literal["github", "ollama"]

DEFAULT_SYSTEM_MESSAGE = (
    "You are Brunella's AutoGen pilot assistant. "
    "Return concise, actionable answers optimized for engineering workflows."
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AutoGenRunResult:
    provider: ResolvedProvider
    model: str
    output: str
    stop_reason: str | None
    message_count: int


class AutoGenAdapter:
    def __init__(
        self,
        config: BackendConfig,
        *,
        github_token: str | None = None,
        github_endpoint: str | None = None,
        github_model: str | None = None,
        ollama_model: str | None = None,
        max_chars: int = 12000,
    ):
        self._ollama_base_url = config.ollama_base_url.rstrip("/")
        self._ollama_model = (
            ollama_model
            or os.getenv("AUTOGEN_OLLAMA_MODEL")
            or os.getenv("OLLAMA_MODEL")
            or config.default_model
        ).strip()
        self._github_token = _normalize_value(
            github_token or os.getenv("GITHUB_PAT") or os.getenv("GITHUB_TOKEN")
        )
        self._github_endpoint = (
            github_endpoint or os.getenv("GITHUB_MODELS_ENDPOINT") or "https://models.github.ai/inference"
        ).rstrip("/")
        self._github_model = (
            github_model
            or os.getenv("GITHUB_MODELS_DEFAULT_MODEL")
            or os.getenv("GITHUB_MODELS_MODEL")
            or "openai/gpt-5-mini"
        ).strip()
        self._max_chars = max_chars
        self._github_timeout_seconds = _parse_float_env(
            "AUTOGEN_GITHUB_TIMEOUT_SECONDS", 45.0
        )
        self._ollama_timeout_seconds = _parse_float_env(
            "AUTOGEN_OLLAMA_TIMEOUT_SECONDS", 60.0
        )
        self._github_max_attempts = _parse_int_env("AUTOGEN_GITHUB_MAX_ATTEMPTS", 2)
        self._ollama_max_attempts = _parse_int_env("AUTOGEN_OLLAMA_MAX_ATTEMPTS", 1)

    @property
    def enabled(self) -> bool:
        try:
            import autogen_agentchat  # noqa: F401
            import autogen_ext  # noqa: F401
            return True
        except Exception:
            return False

    def resolve_provider(self, prefer_provider: ProviderPreference = "auto") -> ResolvedProvider:
        normalized = prefer_provider.strip().lower()
        if normalized not in {"auto", "github", "ollama"}:
            raise RuntimeError(
                "Unsupported provider preference. Use one of: auto, github, ollama"
            )

        if normalized == "github":
            if not self._github_token:
                raise RuntimeError(
                    "GitHub Models selected but GITHUB_PAT or GITHUB_TOKEN is missing"
                )
            return "github"

        if normalized == "ollama":
            return "ollama"

        return "github" if self._github_token else "ollama"

    async def run(
        self,
        task: str,
        *,
        system_message: str | None = None,
        prefer_provider: ProviderPreference = "auto",
        model: str | None = None,
    ) -> AutoGenRunResult:
        normalized_task = task.strip()
        if not normalized_task:
            raise RuntimeError("Task cannot be empty")
        if len(normalized_task) > self._max_chars:
            raise RuntimeError("Task too long for AutoGen execution")

        provider = self.resolve_provider(prefer_provider)
        try:
            return await self._run_once(
                provider,
                normalized_task,
                system_message=system_message,
                model_override=model,
            )
        except Exception as exc:
            if provider == "github" and prefer_provider == "auto":
                logger.warning(
                    "GitHub Models execution failed in auto mode; falling back to Ollama",
                    extra={"model": model or self._github_model},
                    exc_info=exc,
                )
                return await self._run_once(
                    "ollama",
                    normalized_task,
                    system_message=system_message,
                    model_override=model,
                )
            raise

    async def _run_once(
        self,
        provider: ResolvedProvider,
        task: str,
        *,
        system_message: str | None,
        model_override: str | None,
    ) -> AutoGenRunResult:
        resolved_model = self._resolve_model(provider, model_override)
        client = self._build_client(provider, resolved_model)
        primary_error: Exception | None = None
        try:
            agent = self._create_agent(client, system_message)
            result = await self._run_with_retry(provider, agent, task)
            messages = getattr(result, "messages", None)
            message_count = len(messages) if isinstance(messages, (list, tuple)) else 0
            return AutoGenRunResult(
                provider=provider,
                model=resolved_model,
                output=_extract_result_text(result),
                stop_reason=getattr(result, "stop_reason", None),
                message_count=message_count,
            )
        except Exception as exc:
            primary_error = exc
            raise
        finally:
            await self._close_client(client, primary_error)

    async def _run_with_retry(self, provider: ResolvedProvider, agent: object, task: str):
        attempts = self._github_max_attempts if provider == "github" else self._ollama_max_attempts
        timeout_seconds = (
            self._github_timeout_seconds if provider == "github" else self._ollama_timeout_seconds
        )
        last_error: Exception | None = None
        run = getattr(agent, "run", None)
        if not callable(run):
            raise RuntimeError("AutoGen agent instance does not expose a callable run() method")

        for attempt in range(1, attempts + 1):
            try:
                return await asyncio.wait_for(run(task=task), timeout=timeout_seconds)
            except Exception as exc:
                last_error = exc
                if attempt >= attempts:
                    raise
                backoff_seconds = 0.5 * attempt
                logger.warning(
                    "AutoGen provider attempt failed; retrying",
                    extra={
                        "provider": provider,
                        "attempt": attempt,
                        "max_attempts": attempts,
                    },
                    exc_info=exc,
                )
                await asyncio.sleep(backoff_seconds)

        if last_error is not None:
            raise last_error
        raise RuntimeError("AutoGen execution failed without an explicit exception")

    def _resolve_model(self, provider: ResolvedProvider, model_override: str | None) -> str:
        resolved_model = _normalize_value(model_override) or (
            self._github_model if provider == "github" else self._ollama_model
        )
        if resolved_model is None:
            raise RuntimeError("Unable to resolve a model for AutoGen execution")
        return resolved_model

    def _build_client(self, provider: ResolvedProvider, model: str):
        if provider == "github":
            return self._build_github_client(model)
        return self._build_ollama_client(model)

    def _build_github_client(self, model: str):
        try:
            from azure.core.credentials import AzureKeyCredential
            from autogen_ext.models.azure import AzureAIChatCompletionClient
        except Exception as exc:
            raise RuntimeError(
                "AutoGen GitHub Models dependencies are not installed. "
                "Add autogen-agentchat and autogen-ext[openai,azure]."
            ) from exc

        token = self._github_token
        if not token:
            raise RuntimeError("GitHub Models token is missing")

        return AzureAIChatCompletionClient(
            model=model,
            endpoint=self._github_endpoint,
            credential=AzureKeyCredential(token),
            model_info=_default_model_info(),
        )

    def _build_ollama_client(self, model: str):
        try:
            from autogen_ext.models.openai import OpenAIChatCompletionClient
        except Exception as exc:
            raise RuntimeError(
                "AutoGen OpenAI-compatible dependencies are not installed. "
                "Add autogen-agentchat and autogen-ext[openai,azure]."
            ) from exc

        return OpenAIChatCompletionClient(
            model=model,
            base_url=_as_openai_base_url(self._ollama_base_url),
            api_key="ollama",
            model_info=_default_model_info(),
        )

    def _create_agent(self, client: object, system_message: str | None):
        try:
            from autogen_agentchat.agents import AssistantAgent
        except Exception as exc:
            raise RuntimeError(
                "AutoGen AgentChat is not installed. Add autogen-agentchat."
            ) from exc

        normalized_system_message = (
            system_message.strip()
            if system_message is not None and system_message.strip()
            else DEFAULT_SYSTEM_MESSAGE
        )
        return AssistantAgent(
            name="brunella_autogen",
            model_client=client,
            system_message=normalized_system_message,
        )

    async def _close_client(self, client: object, primary_error: Exception | None = None) -> None:
        close = getattr(client, "close", None)
        if callable(close):
            try:
                result = close()
                if inspect.isawaitable(result):
                    await result
            except Exception as close_error:
                logger.warning("AutoGen client close failed", exc_info=close_error)
                if primary_error is None:
                    raise


def _normalize_value(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _parse_float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _parse_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _default_model_info() -> dict[str, object]:
    return {
        "vision": False,
        "function_calling": False,
        "json_output": False,
        "family": "unknown",
        "structured_output": False,
    }


def _as_openai_base_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    return normalized if normalized.endswith("/v1") else f"{normalized}/v1"


def _extract_result_text(result: object) -> str:
    messages = getattr(result, "messages", None)
    if not messages:
        return ""
    final_message = messages[-1]
    content = getattr(final_message, "content", final_message)
    return _stringify_content(content)


def _stringify_content(content: object) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        return json.dumps(content, ensure_ascii=False)
    if isinstance(content, (list, tuple)):
        parts = [_stringify_content(item) for item in content]
        return "\n".join(part for part in parts if part)
    model_dump = getattr(content, "model_dump", None)
    if callable(model_dump):
        return json.dumps(model_dump(), ensure_ascii=False)
    return str(content)


def build_autogen_adapter(config: BackendConfig) -> AutoGenAdapter:
    return AutoGenAdapter(config)