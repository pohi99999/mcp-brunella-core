# Iron Clad Python AI Backend (Phase 1-2)

OpenAI-kompatibilis FastAPI gateway skeleton + vLLM routing:

- `GET /health`
- `GET /models`
- `POST /chat/completions`

## vLLM integráció (Phase 2)

- `VLLM_BASE_URL`: OpenAI-kompatibilis vLLM endpoint (alapértelmezés: `http://localhost:8001`).
- `IRON_CLAD_HIGH_CAPACITY_MODELS`: vesszővel elválasztott modell lista (pl. `qwen2.5-72b-instruct,gpt-4.1-mini`).
- A felsorolt modellek először vLLM-en futnak; hiba esetén LiteLLM → Ollama fallback lép életbe.

## Futtatás

`python -m myai.backend.app`

Alapértelmezett port: `8010`

## Megjegyzés

Ez a Phase 1 alap. A `litellm` integráció opcionális (ha telepítve van), különben Ollama fallback működik (`/api/generate`).
