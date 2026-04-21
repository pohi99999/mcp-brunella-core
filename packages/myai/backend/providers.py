from __future__ import annotations

import time
from dataclasses import dataclass
from typing import List, Optional

import requests

from .config import BackendConfig
from .schemas import ChatMessage


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def _render_messages(messages: List[ChatMessage]) -> str:
    return "\n".join([f"{m.role.upper()}: {m.content}" for m in messages])


@dataclass
class CompletionResult:
    content: str
    usage: dict[str, int]


class IronCladProviderGateway:
    def __init__(self, config: BackendConfig):
        self.config = config
        self._high_capacity_models = {m.lower() for m in config.high_capacity_models}

    def list_models(self) -> list[dict[str, str]]:
        try:
            response = requests.get(
                f"{self.config.ollama_base_url}/api/tags",
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", [])
            if not models:
                return [{"id": self.config.default_model, "object": "model", "owned_by": "ollama"}]
            return [
                {
                    "id": str(item.get("name", self.config.default_model)),
                    "object": "model",
                    "owned_by": "ollama",
                }
                for item in models
            ]
        except Exception:
            return [{"id": self.config.default_model, "object": "model", "owned_by": "ollama"}]

    def complete_chat(
        self,
        model: str,
        messages: List[ChatMessage],
        temperature: Optional[float] = 0.3,
        max_tokens: Optional[int] = 1024,
    ) -> CompletionResult:
        prompt = _render_messages(messages)
        if self._should_use_vllm(model):
            vllm_result = self._try_vllm(model, messages, temperature, max_tokens)
            if vllm_result is not None:
                return vllm_result
        result = self._try_litellm(model, messages, temperature, max_tokens)
        if result is not None:
            return result
        return self._ollama_fallback(model, prompt, temperature, max_tokens)

    def _should_use_vllm(self, model: str) -> bool:
        if not self.config.vllm_base_url:
            return False
        if not model:
            return False
        return model.lower() in self._high_capacity_models

    def _try_litellm(
        self,
        model: str,
        messages: List[ChatMessage],
        temperature: Optional[float],
        max_tokens: Optional[int],
    ) -> Optional[CompletionResult]:
        try:
            from litellm import completion  # type: ignore

            response = completion(
                model=model,
                messages=[m.model_dump() for m in messages],
                temperature=temperature,
                max_tokens=max_tokens,
            )

            content = (
                response.choices[0].message.content
                if response and response.choices
                else ""
            )
            usage_obj = getattr(response, "usage", None)
            usage = {
                "prompt_tokens": int(getattr(usage_obj, "prompt_tokens", _estimate_tokens(_render_messages(messages)))),
                "completion_tokens": int(getattr(usage_obj, "completion_tokens", _estimate_tokens(content))),
                "total_tokens": int(getattr(usage_obj, "total_tokens", 0)),
            }
            if usage["total_tokens"] == 0:
                usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
            return CompletionResult(content=content or "", usage=usage)
        except Exception:
            return None

    def _try_vllm(
        self,
        model: str,
        messages: List[ChatMessage],
        temperature: Optional[float],
        max_tokens: Optional[int],
    ) -> Optional[CompletionResult]:
        if not self.config.vllm_base_url:
            return None

        payload = {
            "model": model or self.config.default_model,
            "messages": [m.model_dump() for m in messages],
            "temperature": temperature if temperature is not None else 0.3,
            "max_tokens": max_tokens if max_tokens is not None else 1024,
            "stream": False,
        }

        try:
            response = requests.post(
                f"{self.config.vllm_base_url.rstrip('/')}/v1/chat/completions",
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            return None

        choices = data.get("choices") or []
        first_choice = choices[0] if choices else {}
        if isinstance(first_choice, dict):
            message = first_choice.get("message") or {}
        else:
            message = {}
        content = str((message or {}).get("content", ""))
        usage_payload = data.get("usage") or {}
        usage = {
            "prompt_tokens": int(
                usage_payload.get("prompt_tokens", _estimate_tokens(_render_messages(messages)))
            ),
            "completion_tokens": int(
                usage_payload.get("completion_tokens", _estimate_tokens(content))
            ),
            "total_tokens": int(usage_payload.get("total_tokens", 0)),
        }
        if usage["total_tokens"] == 0:
            usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
        return CompletionResult(content=content, usage=usage)

    def _ollama_fallback(
        self,
        model: str,
        prompt: str,
        temperature: Optional[float],
        max_tokens: Optional[int],
    ) -> CompletionResult:
        payload = {
            "model": model or self.config.default_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else 0.3,
                "num_predict": max_tokens if max_tokens is not None else 1024,
            },
        }

        response = requests.post(
            f"{self.config.ollama_base_url}/api/generate",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        content = str(response.json().get("response", "")).strip()
        prompt_tokens = _estimate_tokens(prompt)
        completion_tokens = _estimate_tokens(content)
        return CompletionResult(
            content=content,
            usage={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        )


def create_completion_id() -> str:
    return f"chatcmpl-{int(time.time() * 1000)}"
