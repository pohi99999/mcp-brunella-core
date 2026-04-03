---
description: "Use when writing, editing, or reviewing Python code in the myai/ subsystem. Covers uv package management, Pydantic model requirements, FastAPI/FastMCP patterns, logging rules, and Windows Unicode pitfalls."
applyTo: "myai/**"
---

# BAS Python Subsystem Conventions

## Package manager: `uv` (NOT pip)

```bash
cd myai && uv sync            # install / sync all deps
uv add <package>              # add new dependency → updates pyproject.toml
uv run pytest tests/          # run tests inside the venv
```

- `pyproject.toml` is the **single source of truth** for Python dependencies
- Never use `pip install` directly in this project
- Python 3.12+ required

## Pydantic models — **mandatory**

Every data structure that crosses a function boundary **must** use a Pydantic model. Raw `dict` is not acceptable.

```python
# ✅ correct
from pydantic import BaseModel
from myai.pydantic_models import HarvestResult

class InvoiceData(BaseModel):
    id: str
    amount: float
    date: str
    vendor: str

# ❌ wrong
def process(data: dict) -> dict: ...
```

- Central model file: `myai/pydantic_models.py` — add new models here
- Use `model.model_dump()` (Pydantic v2), **not** `.dict()` (deprecated)
- Prefer `model_validate` over manual construction

## Logging — no emoji, ASCII only

Windows `cp1252` / `cp932` consoles raise `UnicodeEncodeError` on emoji.

```python
# ✅ correct
logger.info("[OK] Harvest complete: %d records", count)
logger.error("[ERROR] FastAPI startup failed: %s", e)

# ❌ wrong  — will crash on Windows terminals
logger.info("✅ Harvest complete")
logger.error("❌ FastAPI startup failed")
```

Use `[OK]`, `[AI]`, `[WARN]`, `[ERROR]`, `[SKIP]` as status prefixes.

## FastAPI & FastMCP

- `myai/server.py` — FastAPI HTTP server on `:8000`; also exposes `/models` and `/v1/models` (OpenAI-compatible)
- `myai/mcp_server.py` — FastMCP stdio/SSE server; requires `FastMCP >= 2.14.3`
- Route handlers should use `async def`; only use sync `def` for CPU-bound operations
- Health endpoint: `GET /health` must always return `{"status": "ok"}`

## Optional heavy imports (LanceDB, browser-use, etc.)

```python
try:
    import lancedb
    HAS_LANCEDB = True
except ImportError:
    HAS_LANCEDB = False

# Guard every usage
if HAS_LANCEDB:
    db = lancedb.connect(...)
```

Do this for any package in the optional `autogen` extra or that may not be installed in all environments.

## Browser automation

- Use `browser-use` for LLM-driven browser automation (not raw Playwright)
- Raw Playwright is only acceptable for scripted, deterministic test flows
- `myai/browser_worker.py` is the canonical browser automation entry point

## Tests

```bash
cd myai && pytest tests/              # run all Python tests
cd myai && pytest tests/test_foo.py  # single file
```

- Test files in `myai/tests/`
- Use `pytest` (not `unittest`)
- Mock external HTTP calls with `respx` or `httpx` test transport

## Starting the server

```bash
cd myai && uvicorn server:app --reload --port 8000
```
