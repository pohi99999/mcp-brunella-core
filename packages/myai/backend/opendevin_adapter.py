from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from typing import Optional

import requests

from .config import BackendConfig


@dataclass(frozen=True)
class OpenDevinResult:
    output: str


class OpenDevinAdapter:
    def __init__(self, config: BackendConfig):
        self._enabled = config.opendevin_enabled
        self._mode = config.opendevin_mode
        self._base_url = config.opendevin_base_url
        self._cli = config.opendevin_cli_command
        self._project_root = config.opendevin_project_root
        self._model_endpoint = config.opendevin_model_endpoint
        self._timeout = config.opendevin_timeout
        self._max_chars = config.opendevin_max_chars

    @property
    def enabled(self) -> bool:
        return self._enabled

    def run(self, task: str) -> OpenDevinResult:
        if not self._enabled:
            raise RuntimeError("OpenDevin is disabled. Set IRON_CLAD_OPENDEVIN_ENABLED=true")
        if len(task) > self._max_chars:
            raise RuntimeError("Task too long for OpenDevin execution")

        mode = self._mode.lower()
        if mode == "http":
            return self._run_http(task)
        if mode == "cli":
            return self._run_cli(task)
        raise RuntimeError(f"Unsupported OpenDevin mode: {mode}")

    def _run_http(self, task: str) -> OpenDevinResult:
        if not self._base_url:
            raise RuntimeError("IRON_CLAD_OPENDEVIN_BASE_URL is required for http mode")

        payload = {
            "task": task,
            "project_root": self._project_root,
            "model_endpoint": self._model_endpoint,
        }
        response = requests.post(
            f"{self._base_url.rstrip('/')}/api/v1/tasks",
            json=payload,
            timeout=self._timeout,
        )
        response.raise_for_status()
        data = response.json()
        output = data.get("output") if isinstance(data, dict) else None
        return OpenDevinResult(output=str(output or data))

    def _run_cli(self, task: str) -> OpenDevinResult:
        if not self._cli:
            raise RuntimeError("IRON_CLAD_OPENDEVIN_CLI is required for cli mode")

        payload = {
            "task": task,
            "project_root": self._project_root,
            "model_endpoint": self._model_endpoint,
        }
        result = subprocess.run(
            self._cli,
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            shell=True,
            timeout=self._timeout,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "OpenDevin CLI failed")
        return OpenDevinResult(output=result.stdout.strip())


def build_opendevin_adapter(config: Optional[BackendConfig] = None) -> OpenDevinAdapter:
    if config is None:
        raise RuntimeError("BackendConfig is required to build OpenDevinAdapter")
    return OpenDevinAdapter(config)
