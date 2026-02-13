# Iron Clad Python AI Backend (Phase 1)

OpenAI-kompatibilis FastAPI gateway skeleton:

- `GET /health`
- `GET /models`
- `POST /chat/completions`

## Futtatás

`python -m myai.backend.app`

Alapértelmezett port: `8010`

## Megjegyzés

Ez a Phase 1 alap. A `litellm` integráció opcionális (ha telepítve van), különben Ollama fallback működik (`/api/generate`).
