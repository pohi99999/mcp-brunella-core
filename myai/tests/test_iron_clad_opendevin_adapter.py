from __future__ import annotations

import pytest

from myai.backend.config import BackendConfig
from myai.backend.opendevin_adapter import OpenDevinAdapter


def make_config(**overrides: object) -> BackendConfig:
    base_kwargs = {
        "ollama_base_url": "http://localhost:11434",
        "default_model": "qwen2.5-coder:latest",
        "backend_name": "iron",
        "vllm_base_url": None,
        "high_capacity_models": ("mega-coder",),
        "gateway_base_url": "http://127.0.0.1:8010",
        "interpreter_enabled": False,
        "interpreter_auto_run": False,
        "interpreter_system_message": None,
        "interpreter_allowed_modes": ("python",),
        "interpreter_max_chars": 4000,
        "opendevin_enabled": False,
        "opendevin_mode": "http",
        "opendevin_base_url": None,
        "opendevin_cli_command": None,
        "opendevin_project_root": None,
        "opendevin_model_endpoint": "http://127.0.0.1:8010",
        "opendevin_timeout": 300,
        "opendevin_max_chars": 8000,
    }
    base_kwargs.update(overrides)
    return BackendConfig(**base_kwargs)  # type: ignore[arg-type]


def test_opendevin_disabled_raises():
    adapter = OpenDevinAdapter(make_config(opendevin_enabled=False))
    with pytest.raises(RuntimeError, match="disabled"):
        adapter.run("fix failing tests")


def test_opendevin_http_requires_base_url():
    adapter = OpenDevinAdapter(make_config(opendevin_enabled=True, opendevin_mode="http"))
    with pytest.raises(RuntimeError, match="BASE_URL"):
        adapter.run("fix failing tests")


def test_opendevin_cli_requires_command():
    adapter = OpenDevinAdapter(make_config(opendevin_enabled=True, opendevin_mode="cli"))
    with pytest.raises(RuntimeError, match="CLI"):
        adapter.run("fix failing tests")
