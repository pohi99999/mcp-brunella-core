#!/bin/bash

# GitHub Labels Setup Script
# Creates all labels needed for GitHub Projects tracking

echo "🏷️  Creating GitHub Labels for Brunella Development Board"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found!"
    echo "   Install from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI found and authenticated"
echo ""

# Track labels
echo "📁 Creating track labels..."
gh label create "track:code-quality" --color "0E8A16" --description "Code quality improvements" --force
gh label create "track:gold-protocol" --color "FFD700" --description "Gold Protocol implementation" --force
gh label create "track:agent-architect" --color "1D76DB" --description "Agent architecture" --force
gh label create "track:cloudflare" --color "F38020" --description "Cloudflare integration" --force
gh label create "track:dashboard" --color "5319E7" --description "Dashboard development" --force
gh label create "track:developer-agent" --color "0052CC" --description "Developer agent" --force
gh label create "track:phoenix-protocol" --color "D93F0B" --description "Phoenix Protocol" --force
gh label create "track:robotkez" --color "C5DEF5" --description "Robotkéz features" --force
echo "   ✅ 8 track labels created"

# Priority labels
echo "🔥 Creating priority labels..."
gh label create "priority:critical" --color "B60205" --description "Critical priority" --force
gh label create "priority:high" --color "D93F0B" --description "High priority" --force
gh label create "priority:medium" --color "FBCA04" --description "Medium priority" --force
gh label create "priority:low" --color "0E8A16" --description "Low priority" --force
echo "   ✅ 4 priority labels created"

# Agent labels
echo "🤖 Creating agent labels..."
gh label create "agent:claude" --color "7057FF" --description "Work by Claude" --force
gh label create "agent:gemini" --color "4285F4" --description "Work by Gemini" --force
gh label create "agent:copilot" --color "000000" --description "Work by Copilot" --force
gh label create "agent:jules" --color "00D4AA" --description "Work by Jules" --force
echo "   ✅ 4 agent labels created"

# Additional labels
echo "➕ Creating additional labels..."
gh label create "track" --color "EDEDED" --description "Development track" --force
gh label create "sprint" --color "EDEDED" --description "Sprint or phase task" --force
gh label create "blocked" --color "D73A4A" --description "Blocked work" --force
gh label create "automated" --color "EDEDED" --description "Created by automation" --force
echo "   ✅ 4 additional labels created"

echo ""
echo "🎉 All labels created successfully!"
echo ""
echo "📊 Total: 20 labels"
echo "   - 8 track labels"
echo "   - 4 priority labels"
echo "   - 4 agent labels"
echo "   - 4 additional labels"
echo ""
echo "✨ You can now use these labels in issues and GitHub Projects!"
