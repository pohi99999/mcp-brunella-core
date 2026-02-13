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


def _normalize_url(value: str | None) -> str | None:
    if not value:
        return None
    trimmed = value.strip()
    return trimmed or None


def _parse_high_capacity_models(value: str | None) -> Tuple[str, ...]:
    if not value:
        return tuple()
    models = [item.strip() for item in value.split(",") if item.strip()]
    return tuple(models)


def get_backend_config() -> BackendConfig:
    return BackendConfig(
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        default_model=os.getenv("IRON_CLAD_DEFAULT_MODEL", "qwen2.5-coder:latest"),
        backend_name=os.getenv("IRON_CLAD_BACKEND_NAME", "iron-clad-python-backend"),
        vllm_base_url=_normalize_url(os.getenv("VLLM_BASE_URL", "http://localhost:8001")),
        high_capacity_models=_parse_high_capacity_models(
            os.getenv("IRON_CLAD_HIGH_CAPACITY_MODELS", "qwen2.5-72b-instruct")
        ),
    )
