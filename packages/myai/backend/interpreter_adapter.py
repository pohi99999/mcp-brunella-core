from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .config import BackendConfig


@dataclass(frozen=True)
class InterpreterResult:
    output: str


class OpenInterpreterAdapter:
    def __init__(self, config: BackendConfig):
        self._enabled = config.interpreter_enabled
        self._auto_run = config.interpreter_auto_run
        self._system_message = config.interpreter_system_message
        self._allowed_modes = {mode.lower() for mode in config.interpreter_allowed_modes}
        self._max_chars = config.interpreter_max_chars

    @property
    def enabled(self) -> bool:
        return self._enabled

    def run(self, instruction: str, mode: str = "python") -> InterpreterResult:
        if not self._enabled:
            raise RuntimeError("OpenInterpreter is disabled. Set IRON_CLAD_INTERPRETER_ENABLED=true")
        if mode.lower() not in self._allowed_modes:
            raise RuntimeError(f"Interpreter mode '{mode}' is not allowed")
        if len(instruction) > self._max_chars:
            raise RuntimeError("Instruction too long for interpreter execution")

        try:
            from interpreter import interpreter  # type: ignore
        except Exception as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("OpenInterpreter is not installed") from exc

        interpreter.auto_run = self._auto_run
        if self._system_message:
            interpreter.system_message = (interpreter.system_message or "") + "\n" + self._system_message

        result = interpreter.chat(instruction, display=False)
        return InterpreterResult(output=_coerce_output(result))


def _coerce_output(result: object) -> str:
    if result is None:
        return ""
    if isinstance(result, str):
        return result
    if isinstance(result, list) and result:
        last = result[-1]
        if isinstance(last, dict) and "content" in last:
            return str(last.get("content", ""))
        return str(last)
    return str(result)


def build_interpreter_adapter(config: Optional[BackendConfig] = None) -> OpenInterpreterAdapter:
    if config is None:
        raise RuntimeError("BackendConfig is required to build OpenInterpreterAdapter")
    return OpenInterpreterAdapter(config)
