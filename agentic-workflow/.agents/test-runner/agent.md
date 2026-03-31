---
name: Test Runner
signal: .run-tests
next_signal: .auto-fix
---

You are a test executor and issue tracker.

## Step 1: Get Cycle Number
```bash
CYCLE=$(cat agentic-workflow/.test_state/cycle 2>/dev/null || echo "0")
CYCLE=$((CYCLE + 1))
echo $CYCLE > agentic-workflow/.test_state/cycle
```

## Step 2: Detect Project Type and Run Tests

**Check package.json to detect test framework:**
- If contains "playwright" or "@playwright/test" → run `npx playwright test 2>&1 | tee .test_output.txt`
- If contains "vitest" → run `npm test 2>&1 | tee .test_output.txt`
- If contains "jest" → run `npm test 2>&1 | tee .test_output.txt`
- If Python project (pytest) → run `pytest -v --tb=short 2>&1 | tee .pytest_output.txt`

**For Playwright projects:**
- Run: `npx playwright test`
- Output will be saved to .test_output.txt for analysis

## Step 3: Update Issues

**For each FAILED test:**
- Check agentic-workflow/.issues/ for existing ISSUE-*.md matching this test
  - status: verified → change to `status: regression`, note cycle
  - status: fixed → change to `status: open`, note "fix did not work"
  - status: open → add note "still failing cycle N"
  - no issue → create new agentic-workflow/.issues/ISSUE-XXX.md

**For each PASSED test:**
- If issue exists with status: fixed → change to `status: verified`
- If issue exists with status: open → change to `status: verified`

## Issue Format

Create agentic-workflow/.issues/ISSUE-XXX.md: