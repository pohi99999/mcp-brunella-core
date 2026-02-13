from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class BackendConfig:
    ollama_base_url: str
    default_model: str
    backend_name: str
    vllm_base_url: str | None
    high_capacity_models: Tuple[str, ...]
    gateway_base_url: str | None
    interpreter_enabled: bool
    interpreter_auto_run: bool
    interpreter_system_message: str | None
    interpreter_allowed_modes: Tuple[str, ...]
    interpreter_max_chars: int


def _normalize_value(value: str | None) -> str | None:
    if not value:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_url(value: str | None) -> str | None:
    return _normalize_value(value)


def _parse_high_capacity_models(value: str | None) -> Tuple[str, ...]:
    if not value:
        return tuple()
    models = [item.strip() for item in value.split(",") if item.strip()]
    return tuple(models)


def _parse_csv(value: str | None) -> Tuple[str, ...]:
    if not value:
        return tuple()
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value: str | None, default: int) -> int:
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def get_backend_config() -> BackendConfig:
    return BackendConfig(
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        default_model=os.getenv("IRON_CLAD_DEFAULT_MODEL", "qwen2.5-coder:latest"),
        backend_name=os.getenv("IRON_CLAD_BACKEND_NAME", "iron-clad-python-backend"),
        vllm_base_url=_normalize_url(os.getenv("VLLM_BASE_URL", "http://localhost:8001")),
        high_capacity_models=_parse_high_capacity_models(
            os.getenv("IRON_CLAD_HIGH_CAPACITY_MODELS", "qwen2.5-72b-instruct")
        ),
        gateway_base_url=_normalize_url(
            os.getenv("IRON_CLAD_GATEWAY_URL", "http://127.0.0.1:8010")
        ),
        interpreter_enabled=_parse_bool(os.getenv("IRON_CLAD_INTERPRETER_ENABLED"), False),
        interpreter_auto_run=_parse_bool(os.getenv("IRON_CLAD_INTERPRETER_AUTO_RUN"), False),
        interpreter_system_message=_normalize_value(
            os.getenv("IRON_CLAD_INTERPRETER_SYSTEM_MESSAGE")
        ),
        interpreter_allowed_modes=_parse_csv(
            os.getenv("IRON_CLAD_INTERPRETER_ALLOWED_MODES", "python")
        ),
        interpreter_max_chars=_parse_int(os.getenv("IRON_CLAD_INTERPRETER_MAX_CHARS"), 4000),
    )
