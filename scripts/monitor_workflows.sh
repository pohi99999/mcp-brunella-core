#!/bin/bash
# GitHub Actions Monitoring Script
# Ellenőrzi a workflow futásokat és statisztikákat

echo "═══════════════════════════════════════════════════════"
echo "  GitHub Actions Monitoring Report"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "${RED}❌ GitHub CLI (gh) not installed${NC}"
    echo "Install: https://cli.github.com/"
    exit 1
fi

echo "📊 Workflow Summary (Last 7 Days)"
echo "─────────────────────────────────────────────────────"

# Get workflow runs from last 7 days
SEVEN_DAYS_AGO=$(date -u -d '7 days ago' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v-7d '+%Y-%m-%dT%H:%M:%SZ')

echo ""
echo "🔍 Runner Health Workflow"
gh run list --workflow=runner-health.yml --limit 50 --created ">$SEVEN_DAYS_AGO" --json conclusion,status,createdAt | \
  jq -r '. | length as $total | map(select(.conclusion == "success")) | length as $success | 
  "  Total runs: \($total)\n  Successful: \($success)\n  Failed: \($total - $success)"'

echo ""
echo "🔍 Gemini Scheduled Triage Workflow"
gh run list --workflow=gemini-scheduled-triage.yml --limit 50 --created ">$SEVEN_DAYS_AGO" --json conclusion,status,createdAt | \
  jq -r '. | length as $total | map(select(.conclusion == "success")) | length as $success | 
  "  Total runs: \($total)\n  Successful: \($success)\n  Failed: \($total - $success)"'

echo ""
echo "🔍 Jules Async Tests Workflow"
gh run list --workflow=jules-async-tests.yml --limit 50 --created ">$SEVEN_DAYS_AGO" --json conclusion,status,createdAt | \
  jq -r '. | length as $total | map(select(.conclusion == "success")) | length as $success | 
  "  Total runs: \($total)\n  Successful: \($success)\n  Failed: \($total - $success)"'

echo ""
echo "═══════════════════════════════════════════════════════"
echo "📈 Expected vs Actual Runs per Day"
echo "─────────────────────────────────────────────────────"
echo ""
echo "Expected after optimization:"
echo "  • Runner Health: 4 runs/day (every 6 hours)"
echo "  • Gemini Triage: 2 runs/day (8 AM, 8 PM)"
echo "  • Jules Async: 6 runs/day (every 4 hours)"
echo "  • TOTAL: ~12 runs/day"
echo ""

# Calculate actual runs per day
TOTAL_RUNS=$(gh run list --limit 1000 --created ">$SEVEN_DAYS_AGO" --json conclusion | jq 'length')
DAYS=7
RUNS_PER_DAY=$((TOTAL_RUNS / DAYS))

echo "Actual (last 7 days):"
echo "  • Total runs: $TOTAL_RUNS"
echo "  • Runs per day: ~$RUNS_PER_DAY"
echo ""

# Compare with expected
if [ $RUNS_PER_DAY -le 20 ]; then
    echo "${GREEN}✅ Optimization successful! ($RUNS_PER_DAY runs/day <= 20 expected)${NC}"
elif [ $RUNS_PER_DAY -le 40 ]; then
    echo "${YELLOW}⚠️  Better, but still high ($RUNS_PER_DAY runs/day)${NC}"
else
    echo "${RED}❌ Still too many runs ($RUNS_PER_DAY runs/day)${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "💡 Tips:"
echo "  • Wait 24-48 hours for changes to take effect"
echo "  • Check cron schedules in .github/workflows/*.yml"
echo "  • Monitor notification settings in GitHub"
echo "═══════════════════════════════════════════════════════"
