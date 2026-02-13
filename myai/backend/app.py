from __future__ import annotations

import time

from fastapi import FastAPI, HTTPException

from .config import get_backend_config
from .providers import IronCladProviderGateway, create_completion_id
from .schemas import (
    ChatCompletionChoice,
    ChatCompletionsRequest,
    ChatCompletionsResponse,
    ChoiceMessage,
    ModelsResponse,
)


config = get_backend_config()
gateway = IronCladProviderGateway(config)

app = FastAPI(title="Iron Clad Python AI Backend", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": config.backend_name,
        "default_model": config.default_model,
    }


@app.get("/models", response_model=ModelsResponse)
def list_models() -> ModelsResponse:
    return ModelsResponse(data=gateway.list_models())


@app.post("/chat/completions", response_model=ChatCompletionsResponse)
def chat_completions(req: ChatCompletionsRequest) -> ChatCompletionsResponse:
    if req.stream:
        raise HTTPException(status_code=400, detail="Phase 1 skeleton: stream=true még nem támogatott")

    try:
        completion = gateway.complete_chat(
            model=req.model,
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Completion failed: {exc}") from exc

    return ChatCompletionsResponse(
        id=create_completion_id(),
        created=int(time.time()),
        model=req.model,
        choices=[
            ChatCompletionChoice(
                message=ChoiceMessage(content=completion.content),
            )
        ],
        usage=completion.usage,
    )


def start() -> None:
    import uvicorn

    uvicorn.run("myai.backend.app:app", host="127.0.0.1", port=8010, reload=False)


if __name__ == "__main__":
    start()
