from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class BackendConfig:
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    default_model: str = os.getenv("IRON_CLAD_DEFAULT_MODEL", "qwen2.5-coder:latest")
    backend_name: str = os.getenv("IRON_CLAD_BACKEND_NAME", "iron-clad-python-backend")


def get_backend_config() -> BackendConfig:
    return BackendConfig()
