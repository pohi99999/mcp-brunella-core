from __future__ import annotations

import pytest

from myai.backend.config import BackendConfig
from myai.backend.interpreter_adapter import OpenInterpreterAdapter


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


def test_interpreter_disabled_raises():
    adapter = OpenInterpreterAdapter(make_config(interpreter_enabled=False))
    with pytest.raises(RuntimeError, match="disabled"):
        adapter.run("print('hi')")


def test_interpreter_disallowed_mode_blocks_before_import():
    adapter = OpenInterpreterAdapter(
        make_config(interpreter_enabled=True, interpreter_allowed_modes=("python",))
    )
    with pytest.raises(RuntimeError, match="not allowed"):
        adapter.run("echo hello", mode="shell")
