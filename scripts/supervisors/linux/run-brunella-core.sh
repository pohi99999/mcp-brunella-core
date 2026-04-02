#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
NODE_MAX_OLD_SPACE_SIZE="${BRUNELLA_NODE_MAX_OLD_SPACE_SIZE:-3072}"

export NODE_ENV="${NODE_ENV:-production}"
export WEB_UI_ENABLED="${WEB_UI_ENABLED:-true}"
export BRUNELLA_WORKSPACE_ROOT="${BRUNELLA_WORKSPACE_ROOT:-$REPO_ROOT}"

cd "$REPO_ROOT"
exec node "--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}" "$REPO_ROOT/scripts/start-stable.mjs"
