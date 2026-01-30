# ============================================================================
# Brunella Agent System - Full System Test Script
# ============================================================================
# Purpose: Comprehensive diagnostic and testing of all system components
# Date: 2026-01-30
# ============================================================================

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  BRUNELLA SYSTEM - FULL DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# ============================================================================
# FASE 1: Environment & Configuration Check
# ============================================================================
Write-Host "`n[FASE 1] Environment Configuration Check" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

# Check .env file
Write-Host "`n1.1 Checking .env file..." -ForegroundColor White
if (Test-Path ".env") {
    Write-Host "  ✓ .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env"
    Write-Host "  • PORT: $(($envContent | Select-String 'PORT=').ToString().Split('=')[1])" -ForegroundColor Gray
    Write-Host "  • OLLAMA_BASE_URL: $(($envContent | Select-String 'OLLAMA_BASE_URL=').ToString().Split('=')[1])" -ForegroundColor Gray
    Write-Host "  • ANYTHINGLLM_BASE_URL: $(($envContent | Select-String 'ANYTHINGLLM_BASE_URL=').ToString().Split('=')[1])" -ForegroundColor Gray
} else {
    Write-Host "  ✗ .env file NOT FOUND!" -ForegroundColor Red
}

# Check config/index.ts
Write-Host "`n1.2 Checking src/config/index.ts..." -ForegroundColor White
$configPath = "src/config/index.ts"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    if ($configContent -match "workspaceRoot: '([^']+)'") {
        Write-Host "  • workspaceRoot: $($matches[1])" -ForegroundColor Gray
        if ($matches[1] -like "*[ACTIVE]*") {
            Write-Host "  ✗ WARNING: [ACTIVE] prefix found in workspaceRoot!" -ForegroundColor Red
        } else {
            Write-Host "  ✓ workspaceRoot looks correct" -ForegroundColor Green
        }
    }
    if ($configContent -match "systemLogDir: '([^']+)'") {
        Write-Host "  • systemLogDir: $($matches[1])" -ForegroundColor Gray
        if ($matches[1] -like "*[ACTIVE]*") {
            Write-Host "  ✗ WARNING: [ACTIVE] prefix found in systemLogDir!" -ForegroundColor Red
        } else {
            Write-Host "  ✓ systemLogDir looks correct" -ForegroundColor Green
        }
    }
}

# ============================================================================
# FASE 2: Ollama Installation Check
# ============================================================================
Write-Host "`n[FASE 2] Ollama Installation Diagnostics" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n2.1 Finding Ollama installations..." -ForegroundColor White
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCmd) {
    Write-Host "  ✓ Ollama found in PATH: $($ollamaCmd.Source)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Ollama NOT found in PATH!" -ForegroundColor Red
}

# Check common installation paths
$ollamaPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama",
    "C:\Program Files\Ollama",
    "C:\Program Files (x86)\Ollama"
)

Write-Host "`n2.2 Checking installation directories..." -ForegroundColor White
foreach ($path in $ollamaPaths) {
    if (Test-Path $path) {
        Write-Host "  ✓ Found: $path" -ForegroundColor Green
        $files = Get-ChildItem $path -File -ErrorAction SilentlyContinue | Select-Object Name, Length
        foreach ($file in $files) {
            Write-Host "    - $($file.Name) ($([math]::Round($file.Length/1MB, 2)) MB)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  • Not found: $path" -ForegroundColor Gray
    }
}

# Check if Ollama is running
Write-Host "`n2.3 Checking Ollama service status..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 3
    Write-Host "  ✓ Ollama is RUNNING on port 11434" -ForegroundColor Green
    
    # Parse models
    $models = ($response.Content | ConvertFrom-Json).models
    Write-Host "`n  Available models:" -ForegroundColor Gray
    foreach ($model in $models) {
        Write-Host "    - $($model.name) (Size: $([math]::Round($model.size/1GB, 2)) GB)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Ollama is NOT RUNNING (port 11434 unreachable)" -ForegroundColor Red
    Write-Host "    Recommendation: Start Ollama with 'ollama serve' or 'ollama app.exe'" -ForegroundColor Yellow
}

# ============================================================================
# FASE 3: AnythingLLM Check
# ============================================================================
Write-Host "`n[FASE 3] AnythingLLM Desktop App Diagnostics" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n3.1 Checking AnythingLLM installation..." -ForegroundColor White
$anythingLLMPath = "C:\Program Files\AnythingLLM\AnythingLLM.exe"
if (Test-Path $anythingLLMPath) {
    Write-Host "  ✓ AnythingLLM.exe found: $anythingLLMPath" -ForegroundColor Green
    $fileInfo = Get-Item $anythingLLMPath
    Write-Host "    Size: $([math]::Round($fileInfo.Length/1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ AnythingLLM.exe NOT FOUND at expected location!" -ForegroundColor Red
}

Write-Host "`n3.2 Checking AnythingLLM process..." -ForegroundColor White
$anythingLLMProc = Get-Process AnythingLLM* -ErrorAction SilentlyContinue
if ($anythingLLMProc) {
    Write-Host "  ✓ AnythingLLM is RUNNING" -ForegroundColor Green
    $totalMemory = ($anythingLLMProc | Measure-Object -Property WS -Sum).Sum / 1GB
    Write-Host "    Processes: $($anythingLLMProc.Count)" -ForegroundColor Gray
    Write-Host "    Total Memory: $([math]::Round($totalMemory, 2)) GB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ AnythingLLM is NOT RUNNING" -ForegroundColor Red
    Write-Host "    Recommendation: Start with '& `"$anythingLLMPath`"'" -ForegroundColor Yellow
}

Write-Host "`n3.3 Testing AnythingLLM API..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/ping" -UseBasicParsing -TimeoutSec 3
    Write-Host "  ✓ AnythingLLM API is RESPONDING (Status: $($response.StatusCode))" -ForegroundColor Green
    
    # Check workspaces
    $apiKey = "2GQKGJY-RRK4ESH-JCTWCMJ-CJ9H7M2"
    $headers = @{
        "Authorization" = "Bearer $apiKey"
    }
    $workspaces = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/workspaces" -Headers $headers -UseBasicParsing -TimeoutSec 10
    $workspaceData = $workspaces.Content | ConvertFrom-Json
    Write-Host "`n  Available workspaces:" -ForegroundColor Gray
    foreach ($ws in $workspaceData.workspaces) {
        Write-Host "    - $($ws.name) (slug: $($ws.slug))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ AnythingLLM API is NOT RESPONDING (port 3001 unreachable)" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================================================
# FASE 4: Backend Build & Configuration Check
# ============================================================================
Write-Host "`n[FASE 4] Backend Build & Config Verification" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n4.1 Checking backend build status..." -ForegroundColor White
if (Test-Path "build/server/web.js") {
    $buildFile = Get-Item "build/server/web.js"
    Write-Host "  ✓ build/server/web.js exists" -ForegroundColor Green
    Write-Host "    Last Modified: $($buildFile.LastWriteTime)" -ForegroundColor Gray
    
    # Check if timeout fix is in the build
    $buildContent = Get-Content "build/server/web.js" -Raw
    if ($buildContent -match "timeout.*10000") {
        Write-Host "  ✓ 10-second timeout fix found in build" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Timeout fix NOT found in build - rebuild needed?" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ build/server/web.js NOT FOUND - run 'npm run build'!" -ForegroundColor Red
}

Write-Host "`n4.2 Checking if backend is running..." -ForegroundColor White
$nodeProc = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*web.js*" -or $_.CommandLine -like "*server*" }
if ($nodeProc) {
    Write-Host "  ✓ Backend Node.js process is RUNNING (PID: $($nodeProc.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend is NOT RUNNING" -ForegroundColor Red
    Write-Host "    Recommendation: Start with 'npm run dev'" -ForegroundColor Yellow
}

Write-Host "`n4.3 Testing backend health endpoint..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    $healthData = $response.Content | ConvertFrom-Json
    Write-Host "  ✓ Backend API is RESPONDING (Status: $($healthData.status))" -ForegroundColor Green
    
    Write-Host "`n  Service Health:" -ForegroundColor Gray
    Write-Host "    - Ollama: $($healthData.services.ollama)" -ForegroundColor $(if ($healthData.services.ollama -eq "healthy") { "Green" } else { "Red" })
    Write-Host "    - AnythingLLM: $($healthData.services.anythingllm)" -ForegroundColor $(if ($healthData.services.anythingllm -eq "healthy") { "Green" } else { "Red" })
    Write-Host "    - Agents: $($healthData.services.agents)" -ForegroundColor $(if ($healthData.services.agents -eq "healthy") { "Green" } else { "Red" })
    Write-Host "    - MCP: $($healthData.services.mcp)" -ForegroundColor $(if ($healthData.services.mcp -eq "no_servers") { "Yellow" } else { "Green" })
} catch {
    Write-Host "  ✗ Backend API is NOT RESPONDING (port 3000 unreachable)" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================================================
# FASE 5: Dashboard Check
# ============================================================================
Write-Host "`n[FASE 5] Dashboard UI Diagnostics" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n5.1 Checking dashboard build..." -ForegroundColor White
if (Test-Path "dist") {
    $distFiles = Get-ChildItem "dist" -Recurse -File | Measure-Object -Property Length -Sum
    Write-Host "  ✓ dist/ directory exists" -ForegroundColor Green
    Write-Host "    Files: $($distFiles.Count)" -ForegroundColor Gray
    Write-Host "    Total Size: $([math]::Round($distFiles.Sum/1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ dist/ directory NOT FOUND - run 'npm run build:ui'!" -ForegroundColor Red
}

Write-Host "`n5.2 Checking dashboard dev server..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3
    Write-Host "  ✓ Dashboard dev server is RUNNING (port 5173)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Dashboard dev server is NOT RUNNING (port 5173 unreachable)" -ForegroundColor Red
    Write-Host "    Recommendation: Start with 'npm run dev:ui'" -ForegroundColor Yellow
}

# ============================================================================
# FASE 6: Cross-Connection Validation
# ============================================================================
Write-Host "`n[FASE 6] Cross-Connection Validation" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

Write-Host "`n6.1 Checking Ollama → AnythingLLM connection..." -ForegroundColor White
# This would require checking AnythingLLM config, which is in its own database
Write-Host "  • AnythingLLM should be configured to use: http://127.0.0.1:11434" -ForegroundColor Gray
Write-Host "  • Verify in AnythingLLM UI: Settings → LLM Configuration" -ForegroundColor Gray

Write-Host "`n6.2 Checking Backend → Ollama connection..." -ForegroundColor White
Write-Host "  • Backend uses OLLAMA_BASE_URL from .env: http://127.0.0.1:11434" -ForegroundColor Gray
Write-Host "  • Verified via health check above" -ForegroundColor Gray

Write-Host "`n6.3 Checking Backend → AnythingLLM connection..." -ForegroundColor White
Write-Host "  • Backend uses ANYTHINGLLM_BASE_URL from .env: http://localhost:3001" -ForegroundColor Gray
Write-Host "  • Verified via health check above" -ForegroundColor Gray

Write-Host "`n6.4 Checking Dashboard → Backend connection..." -ForegroundColor White
Write-Host "  • Dashboard apiService.ts should use: http://localhost:3000/api" -ForegroundColor Gray
Write-Host "  • Check browser console for CORS/connection errors" -ForegroundColor Gray

# ============================================================================
# FINAL SUMMARY
# ============================================================================
Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. If Ollama is not running: Start with 'ollama serve' or '& `"C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama app.exe`"'" -ForegroundColor White
Write-Host "2. If AnythingLLM is not running: Start with '& `"C:\Program Files\AnythingLLM\AnythingLLM.exe`"'" -ForegroundColor White
Write-Host "3. Wait 10-15 seconds for services to initialize" -ForegroundColor White
Write-Host "4. If backend is not running: Start with 'npm run dev'" -ForegroundColor White
Write-Host "5. If dashboard is not running: Start with 'npm run dev:ui'" -ForegroundColor White
Write-Host "6. Open browser: http://localhost:5173 (dev) or http://localhost:3000 (prod)" -ForegroundColor White
Write-Host "7. Check SystemHealthCard for all green statuses" -ForegroundColor White

Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
