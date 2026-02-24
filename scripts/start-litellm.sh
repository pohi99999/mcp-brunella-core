#!/bin/bash
# LiteLLM Proxy Startup Script
# Usage: ./scripts/start-litellm.sh [port]

PORT=${1:-4000}

echo "🚀 Starting LiteLLM Proxy on port $PORT..."
echo "📋 Config: litellm_config.yaml"
echo ""

# Check if litellm is installed
if ! command -v litellm &> /dev/null; then
    echo "❌ LiteLLM not found. Installing..."
    pip install 'litellm[proxy]'
fi

# Check if config exists
if [ ! -f "litellm_config.yaml" ]; then
    echo "❌ litellm_config.yaml not found!"
    exit 1
fi

# Check environment variables
if [ -z "$GITHUB_PAT" ]; then
    echo "⚠️  Warning: GITHUB_PAT not set (GitHub Models unavailable)"
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY not set (Gemini unavailable)"
fi

echo ""
echo "✅ Starting proxy..."
echo "   Access at: http://localhost:$PORT"
echo "   Health check: http://localhost:$PORT/health"
echo ""

# Start LiteLLM proxy
litellm --config litellm_config.yaml --port $PORT
