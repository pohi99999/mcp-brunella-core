#!/bin/bash
# Setup Wrangler Secrets for Research Agent

set -e

echo "🔐 Setting up Wrangler Secrets for research-agent..."
echo ""

# API Keys (from .env)
GEMINI_KEY="AIzaSyCfd_HtE_P_-jjfqAH1Ad5XTnbBAsYGmvo"
GITHUB_TOKEN="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"
OPENAI_KEY="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"

# Development environment
echo "📝 Setting secrets for development environment..."
echo "$GEMINI_KEY" | npx wrangler secret put GEMINI_API_KEY --env development 2>&1 | grep -v "Secret stored" || true
echo "$GITHUB_TOKEN" | npx wrangler secret put GITHUB_TOKEN --env development 2>&1 | grep -v "Secret stored" || true
echo "$OPENAI_KEY" | npx wrangler secret put OPENAI_API_KEY --env development 2>&1 | grep -v "Secret stored" || true

echo "✅ Development secrets set!"
echo ""

# Production environment
echo "📝 Setting secrets for production environment..."
echo "$GEMINI_KEY" | npx wrangler secret put GEMINI_API_KEY --env production 2>&1 | grep -v "Secret stored" || true
echo "$GITHUB_TOKEN" | npx wrangler secret put GITHUB_TOKEN --env production 2>&1 | grep -v "Secret stored" || true
echo "$OPENAI_KEY" | npx wrangler secret put OPENAI_API_KEY --env production 2>&1 | grep -v "Secret stored" || true

echo "✅ Production secrets set!"
echo ""
echo "🎉 All secrets configured successfully!"
