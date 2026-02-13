# Iron Clad Python AI Backend (Phase 1-5)

OpenAI-kompatibilis FastAPI gateway skeleton + vLLM routing:

- `GET /health`
- `GET /models`
- `POST /chat/completions`

## vLLM integráció (Phase 2)

- `VLLM_BASE_URL`: OpenAI-kompatibilis vLLM endpoint (alapértelmezés: `http://localhost:8001`).
- `IRON_CLAD_HIGH_CAPACITY_MODELS`: vesszővel elválasztott modell lista (pl. `qwen2.5-72b-instruct,gpt-4.1-mini`).
- A felsorolt modellek először vLLM-en futnak; hiba esetén LiteLLM → Ollama fallback lép életbe.

## LangGraph orchestration (Phase 3)

- `IRON_CLAD_GATEWAY_URL`: a FastAPI gateway elérhetősége (alapértelmezés: `http://127.0.0.1:8010`).
- A LangGraph workflow a gateway `/chat/completions` endpointot használja, így a vLLM/LiteLLM/Ollama routing automatikusan érvényesül.
- Fő node-ok: Supervisor → Diagnosztika → Terv → Javító, checkpointinggel.

## OpenInterpreter integráció (Phase 4)

- `IRON_CLAD_INTERPRETER_ENABLED`: `true/false` (alap: `false`)
- `IRON_CLAD_INTERPRETER_AUTO_RUN`: `true/false` (alap: `false`)
- `IRON_CLAD_INTERPRETER_ALLOWED_MODES`: engedélyezett módok (alap: `python`)
- `IRON_CLAD_INTERPRETER_MAX_CHARS`: maximális utasítás hossz (alap: `4000`)
- `IRON_CLAD_INTERPRETER_SYSTEM_MESSAGE`: opcionális system prompt bővítés

Az execute node az első javító akciót futtatja OpenInterpreterrel (ha engedélyezett),
és az eredményt a workflow állapotába menti.

## OpenDevin integráció (Phase 5)

- `IRON_CLAD_OPENDEVIN_ENABLED`: `true/false` (alap: `false`)
- `IRON_CLAD_OPENDEVIN_MODE`: `http` vagy `cli` (alap: `http`)
- `IRON_CLAD_OPENDEVIN_BASE_URL`: HTTP mód esetén a szolgáltatás alap URL-je
- `IRON_CLAD_OPENDEVIN_CLI`: CLI mód esetén parancs/útvonal
- `IRON_CLAD_OPENDEVIN_PROJECT_ROOT`: opcionális projekt gyökér
- `IRON_CLAD_OPENDEVIN_MODEL_ENDPOINT`: a gateway URL (alap: `http://127.0.0.1:8010`)
- `IRON_CLAD_OPENDEVIN_TIMEOUT`: időlimit (alap: `300`)
- `IRON_CLAD_OPENDEVIN_MAX_CHARS`: max feladat hossz (alap: `8000`)

A `devin` node a diagnózis + terv + akció összefűzött feladatát adja át OpenDevinnek,
és az eredményt visszacsatolja a workflow állapotába.

## Futtatás

`python -m myai.backend.app`

Alapértelmezett port: `8010`

## Megjegyzés

Ez a Phase 1 alap. A `litellm` integráció opcionális (ha telepítve van), különben Ollama fallback működik (`/api/generate`).
