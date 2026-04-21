#!/bin/bash

set -e

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

AGENT=$1
AGENT_DIR="$SCRIPT_DIR/.agents/$AGENT"

# Help
if [ -z "$AGENT" ]; then
    echo "Usage: ./start-agent.sh <agent-name>"
    echo ""
    echo "Available agents:"
    for dir in "$SCRIPT_DIR/.agents"/*/; do
        name=$(basename "$dir")
        echo "  - $name"
    done
    exit 1
fi

# Validate
if [ ! -d "$AGENT_DIR" ]; then
    echo "❌ Unknown agent: $AGENT"
    echo ""
    echo "Available agents:"
    for dir in "$SCRIPT_DIR/.agents"/*/; do
        name=$(basename "$dir")
        echo "  - $name"
    done
    exit 1
fi

# Parse agent.md frontmatter
AGENT_FILE="$AGENT_DIR/agent.md"
NAME=$(grep "^name:" "$AGENT_FILE" | cut -d':' -f2- | xargs)
SIGNAL=$(grep "^signal:" "$AGENT_FILE" | cut -d':' -f2- | xargs)
NEXT_SIGNAL=$(grep "^next_signal:" "$AGENT_FILE" | cut -d':' -f2- | xargs)

# Extract prompt (everything after the second ---)
PROMPT=$(awk '/^---$/{count++; next} count>=2' "$AGENT_FILE")

# Change to project directory
cd "$PROJECT_DIR"

# Setup directories
mkdir -p "$SCRIPT_DIR/.issues" "$SCRIPT_DIR/.test_state" "$SCRIPT_DIR/.screenshots" tests

# Set terminal title
echo -ne "\033]0;${NAME}\007"

# Header
echo "╔═══════════════════════════════════════╗"
printf "║  Conductor: %-28s║\n" "$NAME"
echo "╠═══════════════════════════════════════╣"
printf "║  Watching: %-26s║\n" "$SIGNAL"
if [ -n "$NEXT_SIGNAL" ]; then
printf "║  Signals:  %-26s║\n" "$NEXT_SIGNAL"
fi
echo "╚═══════════════════════════════════════╝"
echo ""

# Watch loop
while true; do
    if [ -f "$SCRIPT_DIR/$SIGNAL" ]; then
        rm "$SCRIPT_DIR/$SIGNAL"
        
        TIMESTAMP=$(date '+%H:%M:%S')
        echo ""
        echo "═══════════════════════════════════════"
        echo "  Conductor: $NAME — $TIMESTAMP"
        echo "═══════════════════════════════════════"
        echo ""
        
        # Run Claude with the prompt in dangerous mode (auto-approve file writes)
        claude -p "$PROMPT" --dangerously-skip-permissions --verbose
        
        # Chain to next agent if configured
        if [ -n "$NEXT_SIGNAL" ]; then
            touch "$SCRIPT_DIR/$NEXT_SIGNAL"
            echo ""
            echo "→ Signaled: $NEXT_SIGNAL"
        fi
        
        echo ""
        echo "✓ Complete"
        echo ""
    fi
    sleep 2
done