#!/bin/bash
# branch-cleanup.sh - Identify merged branches for cleanup

set -e

echo "🌿 Branch Cleanup Analysis"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Local branches merged into main ===${NC}"
MERGED_LOCAL=$(git branch --merged main | grep -v "^\*" | grep -v "main" | grep -v "develop" || true)
if [ -z "$MERGED_LOCAL" ]; then
    echo "  ✓ No merged local branches to clean up"
else
    echo "$MERGED_LOCAL"
fi
echo ""

echo -e "${BLUE}=== Remote branches merged into main ===${NC}"
git fetch origin --prune 2>/dev/null
MERGED_REMOTE=$(git branch -r --merged origin/main | grep -v "main" | grep -v "HEAD" | sed 's/origin\///' || true)
if [ -z "$MERGED_REMOTE" ]; then
    echo "  ✓ No merged remote branches to clean up"
else
    echo "$MERGED_REMOTE"
fi
echo ""

echo -e "${BLUE}=== Active local branches ===${NC}"
ACTIVE_BRANCHES=$(git branch | grep -v "^\*" | grep -v "main" || true)
BRANCH_COUNT=$(echo "$ACTIVE_BRANCHES" | grep -v '^$' | wc -l || echo "0")
echo "  Total active branches: $BRANCH_COUNT"
if [ "$BRANCH_COUNT" -gt 5 ]; then
    echo -e "  ${YELLOW}⚠️  Warning: More than 5 active branches detected${NC}"
fi
echo ""

echo -e "${GREEN}=== Commands for cleanup ===${NC}"
echo ""
echo "Delete local merged branch:"
echo "  git branch -d <branch-name>"
echo ""
echo "Delete remote merged branch:"
echo "  git push origin --delete <branch-name>"
echo ""
echo "Prune deleted remote tracking branches:"
echo "  git remote prune origin"
echo ""
echo "Delete all local merged branches (use with caution):"
echo "  git branch --merged main | grep -v 'main' | xargs git branch -d"
echo ""

echo "✅ Analysis complete!"
