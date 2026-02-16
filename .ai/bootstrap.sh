#!/bin/bash
# Brunella Bootstrap Script - Agent Context Auto-Sync
# Használat: bash .ai/bootstrap.sh (minden munkamenet ELEJÉN)

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 BRUNELLA BOOTSTRAP - Agent Context Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_FILE="$PROJECT_ROOT/.ai/BOOTSTRAP.md"

if [ ! -f "$BOOTSTRAP_FILE" ]; then
  echo "❌ HIBA: BOOTSTRAP.md nem található!"
  echo "   Elérési út: $BOOTSTRAP_FILE"
  exit 1
fi

echo "✅ BOOTSTRAP.md megtalálva: $BOOTSTRAP_FILE"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. TEMP directory (minden ügynök látja)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEMP_DIR="/tmp/brunella_context"
mkdir -p "$TEMP_DIR"
cp "$BOOTSTRAP_FILE" "$TEMP_DIR/BOOTSTRAP.md"
echo "📂 Temp context: $TEMP_DIR/BOOTSTRAP.md"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CLAUDE Code workspace (ha van)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLAUDE_DIR="$HOME/.claude/projects/F--mcp-brunella-core"
if [ -d "$CLAUDE_DIR" ]; then
  mkdir -p "$CLAUDE_DIR/context"
  cp "$BOOTSTRAP_FILE" "$CLAUDE_DIR/context/BOOTSTRAP.md"
  echo "✅ Claude Code: $CLAUDE_DIR/context/BOOTSTRAP.md"
else
  echo "⚠️  Claude Code workspace nem található (várható lokáció: $CLAUDE_DIR)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. GEMINI CLI workspace (ha van)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GEMINI_DIR="$HOME/.gemini-cli"
if [ -d "$GEMINI_DIR" ]; then
  mkdir -p "$GEMINI_DIR/context"
  cp "$BOOTSTRAP_FILE" "$GEMINI_DIR/context/BOOTSTRAP.md"
  echo "✅ Gemini CLI: $GEMINI_DIR/context/BOOTSTRAP.md"
else
  echo "⚠️  Gemini CLI workspace nem található (várható lokáció: $GEMINI_DIR)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. JULES workspace (ha van)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JULES_DIR="$HOME/.jules"
if [ -d "$JULES_DIR" ]; then
  mkdir -p "$JULES_DIR/context"
  cp "$BOOTSTRAP_FILE" "$JULES_DIR/context/BOOTSTRAP.md"
  echo "✅ Jules AI: $JULES_DIR/context/BOOTSTRAP.md"
else
  echo "⚠️  Jules workspace nem található (várható lokáció: $JULES_DIR)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. CURSOR workspace (ha van)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURSOR_DIR="$HOME/.cursor"
if [ -d "$CURSOR_DIR" ]; then
  mkdir -p "$CURSOR_DIR/context"
  cp "$BOOTSTRAP_FILE" "$CURSOR_DIR/context/BOOTSTRAP.md"
  echo "✅ Cursor: $CURSOR_DIR/context/BOOTSTRAP.md"
else
  echo "⚠️  Cursor workspace nem található (várható lokáció: $CURSOR_DIR)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. VS Code Copilot (shared workspace)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VSCODE_DIR="$PROJECT_ROOT/.vscode"
if [ -d "$VSCODE_DIR" ]; then
  cp "$BOOTSTRAP_FILE" "$VSCODE_DIR/BOOTSTRAP.md"
  echo "✅ VS Code Copilot: .vscode/BOOTSTRAP.md"
else
  echo "⚠️  VS Code workspace nem található"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. PROJECT ROOT (backup, mindenki látja)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cp "$BOOTSTRAP_FILE" "$PROJECT_ROOT/BOOTSTRAP.md"
echo "✅ Project root: BOOTSTRAP.md (backup)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 BOOTSTRAP SYNC KÉSZ!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 KÖVETKEZŐ LÉPÉSEK (ügynököknek):"
echo "   1. Olvasd be: BOOTSTRAP.md (ez a fájl)"
echo "   2. Olvasd be: README.md"
echo "   3. Olvasd be: .ai/FOSZAL.md (utolsó 100 sor)"
echo "   4. Olvasd be: conductor/tracks.md"
echo "   5. Kezdj dolgozni!"
echo ""
echo "🔄 HASZNÁLAT (minden munkamenet ELEJÉN):"
echo "   bash .ai/bootstrap.sh"
echo ""
