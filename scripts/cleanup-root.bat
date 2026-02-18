@echo off
REM ==========================================
REM Brunella Root Cleanup Script
REM Moves temporary/old files to _archive
REM ==========================================

setlocal enabledelayedexpansion

echo.
echo === BRUNELLA ROOT CLEANUP ===
echo.

REM Set archive destination
set ARCHIVE_DIR=_archive\root-cleanup-2026-02-18
mkdir "!ARCHIVE_DIR!" 2>nul

echo Archiving log files...
for %%F in (*.log *.txt) do (
    if exist "%%F" (
        move /Y "%%F" "!ARCHIVE_DIR!\" >nul
        echo   + %%F
    )
)

echo.
echo Archiving project report files...
for %%F in (BEFORE_AFTER_COMPARISON.md COMPLETED_PROJECTS.md DASHBOARD_TEST_REPORT.md REPO_CLEANUP_SUMMARY.md ROBOTKEZV2_TEST_SUMMARY.md TEST_RESULTS.md _ARCHIVE_SESSION_COMPLETION_REPORT.md) do (
    if exist "%%F" (
        move /Y "%%F" "!ARCHIVE_DIR!\" >nul
        echo   + %%F
    )
)

echo.
echo Archiving configuration templates...
for %%F in (run-helper.cmd.template run-helper.sh.template open-vscode-insiders.bat) do (
    if exist "%%F" (
        move /Y "%%F" "!ARCHIVE_DIR!\" >nul
        echo   + %%F
    )
)

echo.
echo Archiving miscellaneous files...
for %%F in (latest_email.html screenshot.png mag.md konyvtarfa.md peterpohankapersonal@gmail.com.ical.zip) do (
    if exist "%%F" (
        move /Y "%%F" "!ARCHIVE_DIR!\" >nul
        echo   + %%F
    )
)

echo.
echo Cleaning up test configuration files...
for %%F in (test-research-query.json test-results-tmp.json testout.txt bifrost_retest.txt) do (
    if exist "%%F" (
        move /Y "%%F" "!ARCHIVE_DIR!\" >nul
        echo   + %%F
    )
)

echo.
echo Archiving old database/config files...
for %%F in (agents.db sqlite3.db _diag _br_temp _KNOWLEDGE_BASE) do (
    if exist "%%F" (
        REM For directories, use /s (recursive) and /e (empty directories)
        if exist "%%F\" (
            mkdir "!ARCHIVE_DIR!\%%F" 2>nul
            xcopy "%%F" "!ARCHIVE_DIR!\%%F" /E /I /Y >nul 2>&1
            rmdir /S /Q "%%F"
            echo   + %%F (directory)
        ) else (
            move /Y "%%F" "!ARCHIVE_DIR!\" >nul
            echo   + %%F
        )
    )
)

echo.
echo ✅ Cleanup complete!
echo.
echo Archived to: !ARCHIVE_DIR!
echo.
echo Remaining structure:
echo   ✓ Core: src/, myai/, conductor/, docs/, public/, test/
echo   ✓ Config: package.json, tsconfig.json, .github/, .vscode/, etc.
echo   ✓ Third-party: node_modules/, .venv/, AnythingLLM/, external_research/
echo.
