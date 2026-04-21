#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
PYTHON_PORT="${BRUNELLA_PYTHON_PORT:-8000}"

cd "$REPO_ROOT/myai"

if [[ -x "$REPO_ROOT/myai/.venv/bin/python" ]]; then
  exec "$REPO_ROOT/myai/.venv/bin/python" -m uvicorn server:app --host 0.0.0.0 --port "$PYTHON_PORT"
fi

if [[ -x "$REPO_ROOT/.venv/bin/python" ]]; then
  exec "$REPO_ROOT/.venv/bin/python" -m uvicorn server:app --host 0.0.0.0 --port "$PYTHON_PORT"
fi

if [[ -x "$REPO_ROOT/mcp_env/bin/python" ]]; then
  exec "$REPO_ROOT/mcp_env/bin/python" -m uvicorn server:app --host 0.0.0.0 --port "$PYTHON_PORT"
fi

if command -v uv >/dev/null 2>&1; then
  exec uv run uvicorn server:app --host 0.0.0.0 --port "$PYTHON_PORT"
fi

exec python -m uvicorn server:app --host 0.0.0.0 --port "$PYTHON_PORT"
