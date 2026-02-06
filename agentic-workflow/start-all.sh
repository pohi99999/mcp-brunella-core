#!/bin/bash
# start-all.sh - Launch all agents in VS Code terminal tabs

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Launching agents in VS Code terminals..."
echo ""
echo "Opening 5 terminals:"
echo "  1. Coder"
echo "  2. Test Writer"
echo "  3. Test Runner"
echo "  4. UX Reviewer"
echo "  5. Auto Fixer"
echo ""

# Launch agents in separate VS Code terminal tabs
osascript <<EOF
tell application "Visual Studio Code"
    activate
end tell

tell application "System Events"
    tell process "Code"
        -- Terminal 1: Coder
        keystroke "\`" using {control down}
        delay 0.5
        keystroke "cd '$PROJECT_DIR' && clear && echo '🎯 CODER' && echo '' && echo 'test     → write + run tests' && echo 'ux       → run UX review' && echo 'full     → run all' && echo 'status   → show issues' && echo 'fix N    → fix ISSUE-N' && echo 'fix uxN  → fix UX-N' && echo '' && claude"
        keystroke return

        delay 1

        -- Terminal 2: Test Writer
        keystroke "\`" using {control down}
        delay 0.5
        keystroke "cd '$SCRIPT_DIR' && clear && ./start-agent.sh test-writer"
        keystroke return

        delay 1

        -- Terminal 3: Test Runner
        keystroke "\`" using {control down}
        delay 0.5
        keystroke "cd '$SCRIPT_DIR' && clear && ./start-agent.sh test-runner"
        keystroke return

        delay 1.5

        -- Terminal 4: UX Reviewer
        keystroke "\`" using {control down}
        delay 0.8
        keystroke "cd '$SCRIPT_DIR' && clear && ./start-agent.sh ux-reviewer"
        keystroke return

        delay 1.5

        -- Terminal 5: Auto-Fixer
        keystroke "\`" using {control down}
        delay 0.8
        keystroke "cd '$SCRIPT_DIR' && clear && ./start-agent.sh auto-fixer"
        keystroke return
    end tell
end tell
EOF

echo ""
echo "✅ Terminals 1-4 launched"
echo ""
echo "⚠️  If Auto Fixer (Terminal 5) didn't open, manually run:"
echo "   ./agentic-workflow/start-agent.sh auto-fixer"
echo ""