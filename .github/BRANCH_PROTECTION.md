# 🛡️ Branch Protection Settings

## Recommended Settings for `main` Branch

Menj ide: **Settings → Branches → Add branch protection rule**

Branch name pattern: `main`

---

## ✅ Required Settings (Szigorú)

### Require a pull request before merging
- ✅ **Enabled**
- ✅ **Require approvals:** 1 (recommended)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require review from Code Owners** (if CODEOWNERS file exists)

### Require status checks to pass before merging
- ✅ **Enabled**
- ✅ **Require branches to be up to date before merging**

**Required status checks:**
- `node`
- `vitest`
- `python`

### Require conversation resolution before merging
- ✅ **Enabled** (all review comments must be resolved)

### Require signed commits
- ⚠️ **Optional** (recommended for production)

### Require linear history
- ✅ **Enabled** (enforces squash/rebase merge)

### Require deployments to succeed before merging
- ⚠️ **Optional** (if you have staging environment)

---

## 🔓 Allow force pushes

- ❌ **Disabled** (nobody should force push to main)

---

## 🗑️ Allow deletions

- ❌ **Disabled** (main branch cannot be deleted)

---

## 🤖 Rules Applied to Administrators

- ✅ **Do not allow bypassing the above settings**
  - Administrators MUST follow the same rules
  - Prevents accidental main branch corruption

---

## 🎯 Auto-Merge Configuration

### Who Can Auto-Merge?

1. **Jules (bot account)**
   - Must create PR with `auto-merge` label
   - CI must pass (all checks green)
   - Automatic squash merge

2. **GitHub Actions Bot**
   - Dependabot PRs
   - Automated maintenance PRs

### How to Enable Auto-Merge for a PR?

```bash
# Add auto-merge label
gh pr edit <PR_NUMBER> --add-label "auto-merge"

# Or via GitHub Web UI:
# 1. Go to PR page
# 2. Click "Labels" on right sidebar
# 3. Add "auto-merge" label
```

### Required Checks

All these CI jobs must pass before auto-merge:
- ✅ `node` - Node.js build and test
- ✅ `vitest` - Vitest tests
- ✅ `python` - Python tests

---

## 📋 Workflow Files

The following GitHub Actions workflows support branch protection:

1. **`.github/workflows/auto-merge.yml`**
   - Auto-merges PRs from Jules/bots when CI passes
   - Checks for `auto-merge` label
   - Automatically deletes branch after merge

2. **`.github/workflows/docker-publish.yml`**
   - Builds and publishes Docker images to ghcr.io
   - Runs on push to main or tags
   - Validates docker-compose on PRs

3. **`.github/workflows/branch-cleanup.yml`**
   - Weekly cleanup of merged branches (Sundays at 2:00 UTC)
   - Deletes branches merged to main and older than 30 days
   - Protects main, develop, production branches
   - Creates issue if many branches deleted

---

## 🔧 Setup Instructions

### 1. Enable Branch Protection

1. Go to **Repository Settings → Branches**
2. Click **Add branch protection rule**
3. Enter branch name pattern: `main`
4. Configure settings as described above
5. Click **Create** or **Save changes**

### 2. Create Auto-Merge Label

```bash
# Create the auto-merge label
gh label create "auto-merge" --description "Automatically merge PR when CI passes" --color "0e8a16"
```

Or via GitHub Web UI:
1. Go to **Issues → Labels**
2. Click **New label**
3. Name: `auto-merge`
4. Description: "Automatically merge PR when CI passes"
5. Color: Green (#0e8a16)

### 3. Test the Workflows

```bash
# Test auto-merge (create a test PR with auto-merge label)
git checkout -b test/auto-merge
git commit --allow-empty -m "test: auto-merge workflow"
git push origin test/auto-merge
gh pr create --title "Test auto-merge" --body "Testing auto-merge workflow" --label "auto-merge"

# Test branch cleanup manually
gh workflow run branch-cleanup.yml
```

---

## 📊 Monitoring

### Check Workflow Status

```bash
# List workflow runs
gh run list --workflow=auto-merge.yml
gh run list --workflow=docker-publish.yml
gh run list --workflow=branch-cleanup.yml

# View specific run
gh run view <RUN_ID> --log
```

### Check Protected Branches

```bash
# List branch protection rules
gh api repos/:owner/:repo/branches/main/protection
```

---

## ⚠️ Troubleshooting

### Auto-Merge Not Working?

1. **Check CI status**: All required checks must pass
2. **Check label**: PR must have `auto-merge` label
3. **Check user**: PR author must be Jules, github-actions[bot], or have auto-merge label
4. **Check logs**: View workflow run logs for details

### Branch Not Deleted After Merge?

- Branch deletion may fail if it's a protected branch
- Check workflow logs for error messages
- Manually delete if needed: `git push origin --delete <branch-name>`

### Docker Build Failing?

1. **Check Dockerfiles**: Ensure Dockerfile.python and Dockerfile.node exist
2. **Check registry permissions**: Ensure GITHUB_TOKEN has package write permissions
3. **Check docker-compose.yml**: Validate syntax with `docker-compose config`

---

## 🔒 Security Considerations

1. **Token Permissions**: GITHUB_TOKEN needs appropriate permissions (contents:write, packages:write, issues:write)
2. **Protected Branches**: Never disable branch protection for main
3. **Code Review**: Always require at least one approval for human-created PRs
4. **Signed Commits**: Consider requiring signed commits for production environments

---

## 📚 Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
