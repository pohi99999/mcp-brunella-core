# 🌿 Branch Cleanup Strategy

## Overview

This document defines the branch management strategy for the mcp-brunella-core repository to maintain a clean, organized codebase.

---

## 📋 Branch Naming Conventions

Use the following prefixes for all branches:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/researcher-agent` |
| `fix/` | Bug fixes | `fix/memory-leak` |
| `perf/` | Performance improvements | `perf/async-conductor` |
| `docs/` | Documentation updates | `docs/api-guide` |
| `refactor/` | Code refactoring | `refactor/agent-factory` |
| `chore/` | Maintenance tasks | `chore/dependency-update` |
| `test/` | Test improvements | `test/integration-suite` |

---

## 🚨 Branch Limits

**Policy:** Maximum 3-5 active feature branches per developer at any time.

**Rationale:**
- Focus on completing work before starting new features
- Reduces merge conflicts
- Improves code review quality
- Makes repository easier to navigate

---

## 🧹 Branch Cleanup Process

### Automated Detection Script

Use this script to identify merged branches ready for deletion:

```bash
#!/bin/bash
# branch-cleanup.sh - Identify merged branches

echo "=== Merged branches ready for cleanup ==="
echo ""

# List branches merged into main
echo "Branches merged into main:"
git branch --merged main | grep -v "^\*" | grep -v "main" | grep -v "develop"

echo ""
echo "=== Remote branches merged into main ==="
git branch -r --merged origin/main | grep -v "main" | grep -v "HEAD" | sed 's/origin\///'

echo ""
echo "=== To delete a local branch ==="
echo "git branch -d branch-name"
echo ""
echo "=== To delete a remote branch ==="
echo "git push origin --delete branch-name"
```

### Manual Cleanup Steps

1. **Identify merged branches:**
   ```bash
   # Save the script above as .github/scripts/branch-cleanup.sh
   bash .github/scripts/branch-cleanup.sh
   ```

2. **Verify branch status:**
   ```bash
   # Check if branch has unmerged commits
   git log main..branch-name
   ```

3. **Delete local branch:**
   ```bash
   git branch -d branch-name
   ```

4. **Delete remote branch:**
   ```bash
   git push origin --delete branch-name
   ```

---

## 📝 Branches to Clean Up (Example List)

Update this list periodically after reviewing merged PRs:

### Merged and Ready for Deletion
- ✅ `feature/old-implementation` - Merged in PR #123
- ✅ `fix/urgent-bug` - Merged in PR #124
- ✅ `docs/setup-guide` - Merged in PR #125

### Active Development (Keep)
- 🔄 `feature/new-agent` - In progress
- 🔄 `perf/cache-optimization` - Under review

### Protected Branches (Never Delete)
- 🔒 `main` - Production branch
- 🔒 `develop` - Development branch (if used)

---

## 🛡️ Branch Protection Rules

Recommended branch protection settings for `main`:

1. ✅ Require pull request reviews before merging
2. ✅ Require status checks to pass before merging
3. ✅ Require branches to be up to date before merging
4. ✅ Require conversation resolution before merging
5. ✅ Do not allow bypassing the above settings

---

## 🔄 Regular Maintenance Schedule

- **Weekly:** Review open branches and nudge for PR creation
- **Monthly:** Clean up merged branches
- **Quarterly:** Audit branch protection rules and naming conventions

---

## 📚 Best Practices

1. **Delete branches after merge:** Enable "Automatically delete head branches" in GitHub settings
2. **Short-lived branches:** Aim to merge within 1-2 weeks
3. **Descriptive names:** Use clear, lowercase names with hyphens
4. **Single purpose:** One feature/fix per branch
5. **Keep up to date:** Regularly merge `main` into long-lived branches

---

## 🚀 Quick Reference

```bash
# List all branches
git branch -a

# List merged branches
git branch --merged main

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name

# Prune deleted remote branches
git remote prune origin

# See branch status
git branch -vv
```

---

**Last Updated:** 2026-02-09
**Next Review:** Monthly
