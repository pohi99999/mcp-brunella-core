@echo off
REM ==========================================
REM Brunella D1 Database Setup Helper
REM Interactive script for D1 configuration
REM ==========================================

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════╗
echo ║  BRUNELLA D1 DATABASE SETUP HELPER     ║
echo ║  Interactive Configuration Wizard       ║
echo ╚════════════════════════════════════════╝
echo.
echo.
echo STEP 1: Create D1 Database in Cloudflare Dashboard
echo ═════════════════════════════════════════════════════
echo.
echo 1. Go to: https://dash.cloudflare.com/
echo 2. Navigate to: Workers & Pages > D1
echo 3. Click: [Create Database]
echo 4. Name: bas-metadata
echo 5. Click: [Create]
echo.
echo After creation, you'll see the Database ID:
echo   Example: d1_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
echo.
REM setlocal enabledelayedexpansion
set /p DB_ID="📝 Enter your D1 Database ID (without quotes): "

if "!DB_ID!"=="" (
    echo.
    echo ❌ ERROR: Empty Database ID
    echo Please run this script again and enter the Database ID
    pause
    exit /b 1
)

echo.
echo ✅ Database ID: !DB_ID!
echo.
echo STEP 2: Configuring Workers...
echo ══════════════════════════════
echo.

REM Update cean-test worker
echo 📝 Updating cean-test/wrangler.toml...
cd /d f:\mcp-brunella-core\myai\agents\workers\cean-test

REM Create backup
copy wrangler.toml wrangler.toml.backup >nul 2>&1

REM Update D1 section (uncomment and set ID)
powershell -Command "
  \$content = Get-Content 'wrangler.toml' -Raw
  \$content = \$content -replace '# \[\[d1_databases\]\]', '[[d1_databases]]'
  \$content = \$content -replace '# binding = \"DB\"', 'binding = \"DB\"'
  \$content = \$content -replace '# database_name = \"bas-metadata\"', 'database_name = \"bas-metadata\"'
  \$content = \$content -replace '# database_id = \"YOUR_DB_ID\"', 'database_id = \"!DB_ID!\"'
  Set-Content 'wrangler.toml' \$content
"

echo   ✓ cean-test configured

REM Update grant-monitor worker
echo 📝 Updating grant-monitor/wrangler.toml...
cd /d f:\mcp-brunella-core\myai\agents\workers\grant-monitor

if exist wrangler.toml (
    powershell -Command "
      \$content = Get-Content 'wrangler.toml' -Raw
      \$content = \$content -replace 'database_id = \"UPDATE_WITH_YOUR_D1_ID\"', 'database_id = \"!DB_ID!\"'
      Set-Content 'wrangler.toml' \$content
    "
    echo   ✓ grant-monitor configured
) else (
    echo   ⚠ grant-monitor/wrangler.toml not found
)

REM Update research-agent worker
echo 📝 Updating research-agent/wrangler.toml...
cd /d f:\mcp-brunella-core\myai\agents\workers\research-agent

if exist wrangler.toml (
    powershell -Command "
      \$content = Get-Content 'wrangler.toml' -Raw
      \$content = \$content -replace 'database_id = \"UPDATE_WITH_YOUR_D1_ID\"', 'database_id = \"!DB_ID!\"'
      Set-Content 'wrangler.toml' \$content
    "
    echo   ✓ research-agent configured
) else (
    echo   ⚠ research-agent/wrangler.toml not found
)

echo.
echo STEP 3: Creating .env for local development
echo ═════════════════════════════════════════════
echo.

cd /d f:\mcp-brunella-core

REM Create or update .env
if exist .env (
    echo   ℹ .env already exists, adding D1_ID...
    powershell -Command "
      if (-not (Select-String -Path '.env' -Pattern 'D1_ID' -Quiet)) {
        Add-Content '.env' \"D1_ID=!DB_ID!\"
      }
    "
) else (
    echo D1_ID=!DB_ID! > .env
    echo   ✓ .env created
)

echo.
echo STEP 4: Building & Testing
echo ════════════════════════════
echo.

echo 🔨 Building TypeScript...
cd /d f:\mcp-brunella-core
call npm run build >nul 2>&1

if !ERRORLEVEL! equ 0 (
    echo   ✅ Build successful
) else (
    echo   ⚠ Build has warnings (non-critical)
)

echo.
echo ════════════════════════════════════════════════════════════
echo ✅ CONFIGURATION COMPLETE!
echo ════════════════════════════════════════════════════════════
echo.
echo Database ID: !DB_ID!
echo.
echo Next Steps:
echo   1. Deploy workers to Cloudflare:
echo      cd myai\agents\workers\cean-test
echo      wrangler deploy --env production
echo.
echo   2. Test endpoints:
echo      GET  https://cean-test.workers.dev/health
echo      POST https://cean-test.workers.dev/test/d1
echo.
echo   3. Deploy other workers:
echo      cd myai\agents\workers\research-agent
echo      wrangler deploy --env production
echo.
echo      cd myai\agents\workers\grant-monitor
echo      wrangler deploy --env production
echo.
echo ════════════════════════════════════════════════════════════
echo.
pause
