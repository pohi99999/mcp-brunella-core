from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ChatCompletionsRequest(BaseModel):
    model: str
    messages: List[ChatMessage] = Field(min_length=1)
    temperature: Optional[float] = 0.3
    stream: Optional[bool] = False
    max_tokens: Optional[int] = 1024


class ChoiceMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChoiceMessage
    finish_reason: Literal["stop"] = "stop"


class ChatCompletionsResponse(BaseModel):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: Dict[str, int]


class ModelsResponse(BaseModel):
    object: Literal["list"] = "list"
    data: List[Dict[str, Any]]
