#!/bin/bash
# ============================================================
# Branch Cleanup Script - Brunella Agent System
# ============================================================
# Reduces 39 open PRs → max 4 open branches (main + up to 3)
#
# USAGE:
#   gh auth login                      # Authenticate first
#   chmod +x scripts/cleanup_branches.sh
#   ./scripts/cleanup_branches.sh [--dry-run]
#
# OPTIONS:
#   --dry-run   Show what would happen without actually doing it
#   --merge     Run only merge steps
#   --close     Run only close steps
#
# REQUIRES: gh CLI (https://cli.github.com/) + repo write access
# ============================================================

set -e

REPO="pohi99999/mcp-brunella-core"
DRY_RUN=false
ONLY_MERGE=false
ONLY_CLOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --merge)   ONLY_MERGE=true ;;
    --close)   ONLY_CLOSE=true ;;
    -h|--help)
      sed -n '/^# USAGE:/,/^# REQUIRES:/p' "$0"
      exit 0
      ;;
  esac
done

echo ""
echo -e "${BOLD}${CYAN}============================================================${NC}"
echo -e "${BOLD}${CYAN}  Brunella Branch Cleanup${NC}"
echo -e "${BOLD}${CYAN}  Goal: 39 PRs → max 4 open branches${NC}"
echo -e "${BOLD}${CYAN}============================================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY-RUN MODE] No changes will be made.${NC}"
  echo ""
fi

# ---- Helpers -----------------------------------------------

gh_merge() {
  local PR=$1
  local REASON=$2
  echo -e "${GREEN}[MERGE]${NC} PR #${PR} — ${REASON}"
  if [ "$DRY_RUN" = false ]; then
    gh pr merge "$PR" --repo "$REPO" --squash --delete-branch \
      --body "Squash-merged as part of branch cleanup (max-4-branches policy)." \
      2>&1 || echo -e "${YELLOW}  ↳ Skipped (conflict or already merged)${NC}"
  fi
}

gh_close() {
  local PR=$1
  local REASON=$2
  echo -e "${RED}[CLOSE]${NC} PR #${PR} — ${REASON}"
  if [ "$DRY_RUN" = false ]; then
    gh pr close "$PR" --repo "$REPO" --delete-branch \
      --comment "Closing as part of branch cleanup to keep ≤4 active branches. ${REASON}" \
      2>&1 || echo -e "${YELLOW}  ↳ Skipped (already closed or missing)${NC}"
  fi
}

# ============================================================
# PHASE 1 — MERGE (squash into main)
# ============================================================
# Criteria: complete, non-duplicate, ready-to-merge PRs.
# Ordered from least-risky to most-risky.
# ============================================================

if [ "$ONLY_CLOSE" = false ]; then
  echo ""
  echo -e "${BOLD}PHASE 1 — MERGE into main${NC}"
  echo "------------------------------------------------------------"

  # Performance / optimization (small, focused, low-risk)
  gh_merge 91  "⚡ Optimize MCP file reading with async/await"
  gh_merge 90  "⚡ Optimize listSpecStatuses with concurrent file reads"
  gh_merge 72  "⚡ Optimize file listing performance"
  gh_merge 71  "⚡ Optimized blocking transcription in myai/server.py"
  gh_merge 100 "⚡ Cache ConfigManager instances by cwd"
  gh_merge 63  "⚡ Optimize codebaseIndexer (concurrent file processing)"
  gh_merge 64  "⚡ Async Refactor of Memory Context Utilities"

  # Bug fixes
  gh_merge 96  "🐛 Fix scheduled tasks next_run (cron-parser)"

  # Accessibility / UI (lowest conflict risk — CSS/component only)
  gh_merge 88  "♿ AgentStatusCard accessibility — best a11y PR (supersedes #59,#69,#77)"
  gh_merge 97  "♿ NeuralLinkChat thoughts toggle accessibility"
  gh_merge 101 "🎨 ProcessControlWidget UX improvements (supersedes #102)"

  # Feature PRs — self-contained services
  gh_merge 92  "🔁 FastAPI silent restart logic"
  gh_merge 94  "🔁 Ollama silent restart logic"
  gh_merge 66  "🔒 Integrate audit trail for permission denials"
  gh_merge 93  "📊 Track GitHub Pull Requests in Database"
  gh_merge 73  "📈 Implement CPU usage tracking (native Node.js)"
  gh_merge 98  "🤖 Jules async agent — real API client with fallback"
  gh_merge 99  "🔄 Implement tool execution loop in GitHubModelsAgent"

  # Image handling chain (#79 first, then #80)
  gh_merge 79  "🖼️  Display image description to user"
  gh_merge 80  "🖼️  Optimize middle image messages"

  # KV-SQLite sync
  gh_merge 81  "🗄️  Implement Jules KV-SQLite synchronization"

  # Dependabot (security / dependency update)
  gh_merge 86  "🔐 Dependabot: bump go_modules (security update)"

  echo ""
  echo -e "${GREEN}Phase 1 complete — $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'done').${NC}"
fi

# ============================================================
# PHASE 2 — CLOSE (no merge)
# ============================================================
# Criteria: duplicate, superseded, empty, WIP with no clear
#           deliverable, or sub-PRs whose parent is already merged.
# ============================================================

if [ "$ONLY_MERGE" = false ]; then
  echo ""
  echo -e "${BOLD}PHASE 2 — CLOSE (no merge)${NC}"
  echo "------------------------------------------------------------"

  # Sub-PRs whose parent will be merged above
  gh_close 78  "Sub-PR of #73 (CPU tracking) — parent merged instead"
  gh_close 83  "Sub-PR of #79 (image description) — parent merged instead"
  gh_close 60  "Sub-PR of #59 (a11y) — #88 merged as canonical a11y fix"
  gh_close 61  "Sub-PR of #59 (a11y) — #88 merged as canonical a11y fix [DRAFT]"
  gh_close 62  "Explicitly 'no changes needed' — nothing to merge [DRAFT]"

  # Duplicate accessibility PRs (superseded by #88)
  gh_close 59  "Superseded by #88 (more complete a11y implementation)"
  gh_close 69  "Duplicate of #88 [DRAFT]"
  gh_close 77  "Duplicate of #88 [DRAFT]"

  # Duplicate performance PRs (superseded by merges above)
  gh_close 74  "⚡ Log streaming — superseded by #71 and #91 [DRAFT]"
  gh_close 102 "Duplicate of #101 ProcessControlWidget UX [DRAFT]"

  # Meta / administrative PRs (superseded by this PR)
  gh_close 75  "Previous cleanup plan — superseded by this PR (#103) [DRAFT]"
  gh_close 76  "Bootstrap npm install — temporary, not needed [DRAFT]"
  gh_close 87  "[WIP] Review running processes — no actionable deliverable"

  # Documentation-only (low priority, can be re-opened if needed)
  gh_close 68  "CodeQL docs [DRAFT] — can be re-opened separately if needed"

  # Complex features requiring extended review — re-open separately
  gh_close 67  "Browser Agent chat view — large feature, re-open with fresh branch"
  gh_close 89  "EdgeProxyAgent KV-SQLite — complex infra, re-open with fresh branch"

  # NOTE: PR #103 (this cleanup PR) should be closed manually by the repo owner
  # after verifying the script ran successfully. Run:
  #   gh pr close 103 --repo pohi99999/mcp-brunella-core --delete-branch
  echo -e "${YELLOW}[MANUAL]${NC} PR #103 — Close this cleanup PR manually after verifying results."

  echo ""
  echo -e "${GREEN}Phase 2 complete — $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'done').${NC}"
fi

# ============================================================
# RESULT SUMMARY
# ============================================================

echo ""
echo -e "${BOLD}${CYAN}============================================================${NC}"
echo -e "${BOLD}${CYAN}  Expected End State${NC}"
echo -e "${BOLD}${CYAN}============================================================${NC}"
echo ""
echo -e "  ${GREEN}Open branches after cleanup: 1${NC}"
echo -e "  ${GREEN}  1. main  (all merged changes land here)${NC}"
echo ""
echo -e "  ${YELLOW}PRs merged into main: 22${NC}"
echo -e "  ${RED}PRs closed (no merge): 16 + 1 manual (PR #103)${NC}"
echo ""
echo -e "  Well within the ≤4 open branches policy. ✅"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY-RUN] Re-run without --dry-run to execute.${NC}"
  echo ""
fi

if command -v gh &>/dev/null && [ "$DRY_RUN" = false ]; then
  REMAINING=$(gh pr list --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo "?")
  echo -e "${CYAN}Open PRs remaining: ${REMAINING}${NC}"
fi

echo ""
