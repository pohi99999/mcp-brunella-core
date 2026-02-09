#!/bin/bash
# branch-cleanup.sh - Identify merged branches for cleanup

echo "🌿 Branch Cleanup Analysis"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Auto-detect default branch
DEFAULT_BRANCH=""
if git show-ref --verify --quiet refs/heads/main; then
    DEFAULT_BRANCH="main"
elif git show-ref --verify --quiet refs/heads/master; then
    DEFAULT_BRANCH="master"
elif git show-ref --verify --quiet refs/remotes/origin/main; then
    DEFAULT_BRANCH="origin/main"
elif git show-ref --verify --quiet refs/remotes/origin/master; then
    DEFAULT_BRANCH="origin/master"
else
    echo -e "${YELLOW}⚠️  Could not detect default branch (main/master)${NC}"
    echo "This script works best when you have a main or master branch."
    echo ""
    echo "Available branches:"
    git branch -a 2>/dev/null || echo "  No branches found"
    echo ""
    echo "To use this script:"
    echo "  1. Fetch from remote: git fetch origin"
    echo "  2. Or checkout main/master branch: git checkout main"
    echo ""
    exit 0
fi

echo -e "${BLUE}Using default branch: ${DEFAULT_BRANCH}${NC}"
echo ""

echo -e "${BLUE}=== Local branches merged into ${DEFAULT_BRANCH} ===${NC}"
MERGED_LOCAL=$(git branch --merged "${DEFAULT_BRANCH}" 2>/dev/null | grep -v "^\*" | grep -v "main" | grep -v "master" | grep -v "develop" || true)
if [ -z "$MERGED_LOCAL" ] || [ "$MERGED_LOCAL" = "" ]; then
    echo "  ✓ No merged local branches to clean up"
else
    echo "$MERGED_LOCAL"
fi
echo ""

echo -e "${BLUE}=== Remote branches merged into ${DEFAULT_BRANCH} ===${NC}"
if git fetch origin --prune 2>/dev/null; then
    MERGED_REMOTE=$(git branch -r --merged "${DEFAULT_BRANCH}" 2>/dev/null | grep -v "main" | grep -v "master" | grep -v "HEAD" | sed 's/  origin\///' || true)
    if [ -z "$MERGED_REMOTE" ] || [ "$MERGED_REMOTE" = "" ]; then
        echo "  ✓ No merged remote branches to clean up"
    else
        echo "$MERGED_REMOTE"
    fi
else
    echo "  ⚠️  Could not fetch from origin (authentication may be required)"
fi
echo ""

echo -e "${BLUE}=== Active local branches ===${NC}"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "  Current branch: ${CURRENT_BRANCH}"
ACTIVE_BRANCHES=$(git branch 2>/dev/null | grep -v "^\*" | grep -v "main" | grep -v "master" || true)
BRANCH_COUNT=0
if [ -n "$ACTIVE_BRANCHES" ]; then
    BRANCH_COUNT=$(echo "$ACTIVE_BRANCHES" | grep -v '^$' | wc -l)
fi
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
echo "  git branch --merged ${DEFAULT_BRANCH} | grep -Ev '(main|master|develop)' | xargs -r git branch -d"
echo ""

echo "✅ Analysis complete!"
