# ====================================
# Brunella GitHub Sync Script (PowerShell)
# ====================================
# Advanced sync with GitHub (fetch + pull + conflict handling + Jules PR check)
# Usage: .\sync.ps1 [-Build] [-Test] [-Force] [-Verbose]

[CmdletBinding()]
param(
    [switch]$Build,
    [switch]$Test,
    [switch]$Force,
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "Usage: .\sync.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "OPTIONS:"
    Write-Host "  -Build      Run build check after sync"
    Write-Host "  -Test       Run tests after sync"
    Write-Host "  -Force      Skip stash prompt (auto-stash)"
    Write-Host "  -Verbose    Show detailed output"
    Write-Host "  -Help       Show this help message"
    Write-Host ""
    Write-Host "EXAMPLES:"
    Write-Host "  .\sync.ps1                  # Basic sync"
    Write-Host "  .\sync.ps1 -Build           # Sync + build check"
    Write-Host "  .\sync.ps1 -Build -Test     # Sync + build + tests"
    Write-Host "  .\sync.ps1 -Force           # Auto-stash uncommitted changes"
    Write-Host ""
    exit 0
}

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Header
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Brunella GitHub Sync" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check we're in a git repo
Write-Step "[1/8] Validating repository..."
if (-not (Test-Path .git)) {
    Write-Error "Not a git repository! Run this from project root."
    exit 1
}
Write-Success "Repository validated."

# Step 2: Fetch remote changes
Write-Step "[2/8] Fetching remote changes..."
try {
    git fetch origin 2>&1 | Out-Null
    Write-Success "Fetch complete."
} catch {
    Write-Error "Git fetch failed! Check network connection."
    exit 1
}

# Step 3: Check local status
Write-Step "[3/8] Checking local status..."
$status = git status --short
if ($status) {
    Write-Warning "You have uncommitted changes:"
    $status | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }

    $hasChanges = $true

    if (-not $Force) {
        $response = Read-Host "`nStash changes before pull? (Y/N)"
        if ($response -ne 'Y' -and $response -ne 'y') {
            Write-Host "[ABORT] Sync cancelled. Commit or stash your changes first." -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "Stashing changes..."
    $stashMessage = "Auto-stash before sync - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git stash push -m $stashMessage | Out-Null
    Write-Success "Changes stashed."
} else {
    Write-Success "Working tree clean."
    $hasChanges = $false
}

# Step 4: Check divergence
Write-Step "[4/8] Checking for divergence..."
$localCommits = git rev-list origin/main..HEAD --count
$remoteCommits = git rev-list HEAD..origin/main --count

if ($localCommits -gt 0) {
    Write-Warning "You have $localCommits local commit(s) not pushed."
}
if ($remoteCommits -gt 0) {
    Write-Host "[INFO] Remote has $remoteCommits new commit(s)." -ForegroundColor Cyan
}

# Step 5: Pull changes
Write-Step "[5/8] Pulling changes from origin/main..."
try {
    git pull origin main
    Write-Success "Pull complete."
} catch {
    Write-Error "Git pull failed! You may have merge conflicts."
    Write-Host ""
    Write-Host "Run these commands to resolve:" -ForegroundColor Yellow
    Write-Host "  git status           # See conflicted files"
    Write-Host "  git mergetool        # Resolve conflicts"
    Write-Host "  git commit           # Commit the merge"
    exit 1
}

# Step 6: Restore stashed changes
if ($hasChanges) {
    Write-Step "[6/8] Restoring stashed changes..."
    try {
        git stash pop | Out-Null
        Write-Success "Stashed changes restored."
    } catch {
        Write-Warning "Stash pop had conflicts. Resolve manually with:"
        Write-Host "  git status"
        Write-Host "  git stash list"
    }
} else {
    Write-Step "[6/8] No stashed changes to restore."
}

# Step 7: Check Jules PRs
Write-Step "[7/8] Checking for Jules PRs..."
try {
    $prs = gh pr list --state open --limit 5 --json number,title,author 2>$null | ConvertFrom-Json
    if ($prs.Count -gt 0) {
        Write-Host "Open PRs:" -ForegroundColor Yellow
        foreach ($pr in $prs) {
            Write-Host "  #$($pr.number): $($pr.title) (@$($pr.author.login))" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "[TIP] Review with: gh pr view <number>" -ForegroundColor Yellow
    } else {
        Write-Success "No open PRs."
    }
} catch {
    Write-Host "[SKIP] GitHub CLI not available." -ForegroundColor Gray
}

# Step 8: Optional Build Check
if ($Build) {
    Write-Step "[8/8] Running build check..."
    try {
        npm run build
        Write-Success "Build successful."
    } catch {
        Write-Error "Build failed! Fix errors before continuing."
        exit 1
    }
}

# Step 9: Optional Test Check
if ($Test) {
    Write-Step "[EXTRA] Running tests..."
    try {
        npm test
        Write-Success "All tests passed."
    } catch {
        Write-Warning "Tests failed! Review failures."
    }
}

# Final Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Sync Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Latest 5 commits:" -ForegroundColor Cyan
git log --oneline -5 --color=always
Write-Host ""
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch" -ForegroundColor Cyan
Write-Host ""
Write-Host "[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "  - Start working: npm run dev"
Write-Host "  - View status: git status"
Write-Host "  - View changes: git log --oneline -10"
Write-Host ""
