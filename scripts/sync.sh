#!/bin/bash
# ====================================
# Brunella GitHub Sync Script (Bash)
# ====================================
# Cross-platform sync script for Git Bash / WSL / Linux / macOS
# Usage: ./sync.sh [--build] [--test] [--force]

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
BUILD_CHECK=false
TEST_CHECK=false
FORCE_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --build) BUILD_CHECK=true; shift ;;
        --test) TEST_CHECK=true; shift ;;
        --force) FORCE_MODE=true; shift ;;
        -h|--help)
            echo ""
            echo "Usage: ./sync.sh [OPTIONS]"
            echo ""
            echo "OPTIONS:"
            echo "  --build    Run build check after sync"
            echo "  --test     Run tests after sync"
            echo "  --force    Skip stash prompt (auto-stash)"
            echo "  --help     Show this help message"
            echo ""
            echo "EXAMPLES:"
            echo "  ./sync.sh                 # Basic sync"
            echo "  ./sync.sh --build         # Sync + build check"
            echo "  ./sync.sh --build --test  # Sync + build + tests"
            echo "  ./sync.sh --force         # Auto-stash uncommitted changes"
            echo ""
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Functions
print_step() {
    echo ""
    echo -e "${CYAN}$1${NC}"
}

print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

print_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Header
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Brunella GitHub Sync${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Step 1: Validate repository
print_step "[1/8] Validating repository..."
if [ ! -d .git ]; then
    print_error "Not a git repository! Run this from project root."
    exit 1
fi
print_success "Repository validated."

# Step 2: Fetch remote changes
print_step "[2/8] Fetching remote changes..."
if git fetch origin; then
    print_success "Fetch complete."
else
    print_error "Git fetch failed! Check network connection."
    exit 1
fi

# Step 3: Check local status
print_step "[3/8] Checking local status..."
if [ -n "$(git status --short)" ]; then
    print_warning "You have uncommitted changes:"
    git status --short | sed 's/^/  /'

    HAS_CHANGES=true

    if [ "$FORCE_MODE" = false ]; then
        echo ""
        read -p "Stash changes before pull? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Sync cancelled. Commit or stash your changes first."
            exit 1
        fi
    fi

    echo "Stashing changes..."
    STASH_MSG="Auto-stash before sync - $(date +'%Y-%m-%d %H:%M:%S')"
    git stash push -m "$STASH_MSG"
    print_success "Changes stashed."
else
    print_success "Working tree clean."
    HAS_CHANGES=false
fi

# Step 4: Check divergence
print_step "[4/8] Checking for divergence..."
LOCAL_COMMITS=$(git rev-list origin/main..HEAD --count)
REMOTE_COMMITS=$(git rev-list HEAD..origin/main --count)

if [ "$LOCAL_COMMITS" -gt 0 ]; then
    print_warning "You have $LOCAL_COMMITS local commit(s) not pushed."
fi
if [ "$REMOTE_COMMITS" -gt 0 ]; then
    echo -e "${CYAN}[INFO] Remote has $REMOTE_COMMITS new commit(s).${NC}"
fi

# Step 5: Pull changes
print_step "[5/8] Pulling changes from origin/main..."
if git pull origin main; then
    print_success "Pull complete."
else
    print_error "Git pull failed! You may have merge conflicts."
    echo ""
    echo -e "${YELLOW}Run these commands to resolve:${NC}"
    echo "  git status           # See conflicted files"
    echo "  git mergetool        # Resolve conflicts"
    echo "  git commit           # Commit the merge"
    exit 1
fi

# Step 6: Restore stashed changes
if [ "$HAS_CHANGES" = true ]; then
    print_step "[6/8] Restoring stashed changes..."
    if git stash pop; then
        print_success "Stashed changes restored."
    else
        print_warning "Stash pop had conflicts. Resolve manually with:"
        echo "  git status"
        echo "  git stash list"
    fi
else
    print_step "[6/8] No stashed changes to restore."
fi

# Step 7: Check Jules PRs
print_step "[7/8] Checking for Jules PRs..."
if command -v gh &> /dev/null; then
    PR_COUNT=$(gh pr list --state open --limit 5 --json number 2>/dev/null | jq '. | length' 2>/dev/null || echo 0)
    if [ "$PR_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}Open PRs:${NC}"
        gh pr list --state open --limit 5 --json number,title,author 2>/dev/null | \
            jq -r '.[] | "  #\(.number): \(.title) (@\(.author.login))"' 2>/dev/null || true
        echo ""
        print_warning "Review with: gh pr view <number>"
    else
        print_success "No open PRs."
    fi
else
    echo -e "${NC}[SKIP] GitHub CLI not available.${NC}"
fi

# Step 8: Optional Build Check
if [ "$BUILD_CHECK" = true ]; then
    print_step "[8/8] Running build check..."
    if npm run build; then
        print_success "Build successful."
    else
        print_error "Build failed! Fix errors before continuing."
        exit 1
    fi
fi

# Step 9: Optional Test Check
if [ "$TEST_CHECK" = true ]; then
    print_step "[EXTRA] Running tests..."
    if npm test; then
        print_success "All tests passed."
    else
        print_warning "Tests failed! Review failures."
    fi
fi

# Final Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Sync Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Latest 5 commits:${NC}"
git log --oneline -5 --color=always
echo ""
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${CYAN}Current branch: $CURRENT_BRANCH${NC}"
echo ""
echo -e "${YELLOW}[NEXT STEPS]${NC}"
echo "  - Start working: npm run dev"
echo "  - View status: git status"
echo "  - View changes: git log --oneline -10"
echo ""
