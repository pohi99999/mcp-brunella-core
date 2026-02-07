@echo off
REM ====================================
REM Brunella GitHub Sync Script
REM ====================================
REM Quick sync with GitHub (fetch + pull + status check)
REM Usage: sync.bat [--build] [--test] [--force]

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Brunella GitHub Sync
echo ========================================
echo.

REM Parse arguments
set BUILD_CHECK=0
set TEST_CHECK=0
set FORCE_MODE=0

:parse_args
if "%~1"=="" goto after_args
if /i "%~1"=="--build" set BUILD_CHECK=1
if /i "%~1"=="--test" set TEST_CHECK=1
if /i "%~1"=="--force" set FORCE_MODE=1
if /i "%~1"=="-h" goto help
if /i "%~1"=="--help" goto help
shift
goto parse_args

:after_args

REM Step 1: Fetch remote changes
echo [1/6] Fetching remote changes...
git fetch origin
if errorlevel 1 (
    echo [ERROR] Git fetch failed! Check network connection.
    exit /b 1
)
echo [OK] Fetch complete.
echo.

REM Step 2: Check local status
echo [2/6] Checking local status...
git status --short
if errorlevel 1 (
    echo [ERROR] Git status check failed!
    exit /b 1
)

REM Check for uncommitted changes
git diff --quiet
set HAS_CHANGES=!errorlevel!

if !HAS_CHANGES! neq 0 (
    echo [WARN] You have uncommitted changes!
    if !FORCE_MODE! equ 0 (
        echo.
        choice /C YN /M "Stash changes before pull? (Y=Yes, N=Abort)"
        if errorlevel 2 (
            echo [ABORT] Sync cancelled. Commit or stash your changes first.
            exit /b 1
        )
        git stash push -m "Auto-stash before sync - %date% %time%"
        echo [OK] Changes stashed.
    )
)
echo.

REM Step 3: Pull changes
echo [3/6] Pulling changes from origin/main...
git pull origin main
if errorlevel 1 (
    echo [ERROR] Git pull failed! You may have merge conflicts.
    echo.
    echo Run these commands to resolve:
    echo   git status           # See conflicted files
    echo   git mergetool        # Resolve conflicts
    echo   git commit           # Commit the merge
    exit /b 1
)
echo [OK] Pull complete.
echo.

REM Step 4: Check if stash needs to be popped
if !HAS_CHANGES! neq 0 (
    if !FORCE_MODE! equ 0 (
        echo [4/6] Restoring stashed changes...
        git stash pop
        if errorlevel 1 (
            echo [WARN] Stash pop had conflicts. Resolve manually with:
            echo   git status
            echo   git stash list
        ) else (
            echo [OK] Stashed changes restored.
        )
        echo.
    )
) else (
    echo [4/6] No stashed changes to restore.
    echo.
)

REM Step 5: Check Jules PRs
echo [5/6] Checking for Jules PRs...
gh pr list --state open --limit 5 --json number,title,author 2>nul
if errorlevel 1 (
    echo [SKIP] GitHub CLI not available or no PRs found.
) else (
    echo.
    echo [TIP] Review Jules PRs with: gh pr view ^<number^>
)
echo.

REM Step 6: Optional Build Check
if !BUILD_CHECK! equ 1 (
    echo [6/6] Running build check...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed! Fix errors before continuing.
        exit /b 1
    )
    echo [OK] Build successful.
    echo.
)

REM Step 7: Optional Test Check
if !TEST_CHECK! equ 1 (
    echo [EXTRA] Running tests...
    call npm test
    if errorlevel 1 (
        echo [WARN] Tests failed! Review failures.
    ) else (
        echo [OK] All tests passed.
    )
    echo.
)

REM Final Summary
echo ========================================
echo   Sync Complete!
echo ========================================
echo.
echo Latest 5 commits:
git log --oneline -5
echo.
echo Local branch: %CD%
git branch --show-current
echo.
echo [NEXT STEPS]
echo   - Start working: npm run dev
echo   - View status: git status
echo   - View changes: git log --oneline -10
echo.
exit /b 0

:help
echo.
echo Usage: sync.bat [OPTIONS]
echo.
echo OPTIONS:
echo   --build    Run build check after sync
echo   --test     Run tests after sync
echo   --force    Skip stash prompt (auto-stash)
echo   --help     Show this help message
echo.
echo EXAMPLES:
echo   sync.bat                 # Basic sync
echo   sync.bat --build         # Sync + build check
echo   sync.bat --build --test  # Sync + build + tests
echo   sync.bat --force         # Auto-stash uncommitted changes
echo.
exit /b 0
