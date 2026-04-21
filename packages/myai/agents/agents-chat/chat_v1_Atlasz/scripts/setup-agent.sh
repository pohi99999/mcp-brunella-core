#!/bin/bash

# Skip installing the Python agent when running on Vercel or when explicitly disabled.
if [[ "$VERCEL" == "1" || "$SKIP_AGENT_INSTALL" == "1" ]]; then
	echo "Skipping agent setup (cloud build)."
	exit 0
fi

# Navigate to the agent directory
cd "$(dirname "$0")/../agent" || exit 1

# Install dependencies and create virtual environment using uv
if ! command -v uv >/dev/null 2>&1; then
	echo "uv is not installed. Please install uv from https://github.com/astral-sh/uv and re-run."
	exit 1
fi

uv sync
