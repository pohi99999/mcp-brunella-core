# Cloudflare Browser Rendering REST API - Live Test
# Tests all 8 endpoints against the real CF API
# Usage: powershell -File scripts/test_cf_browser_rendering.ps1

$ErrorActionPreference = 'Continue'

# --- Load .env ---
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (-not (Test-Path $envFile)) {
    # Fallback: try relative to CWD
    $envFile = Join-Path (Get-Location) '.env'
}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line -split '=', 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            [Environment]::SetEnvironmentVariable($key, $val)
        }
    }
    Write-Host "[OK] .env loaded" -ForegroundColor Green
}

$ACCOUNT_ID = $env:CLOUDFLARE_ACCOUNT_ID
$API_TOKEN = $env:CF_API_TOKEN
if (-not $API_TOKEN) { $API_TOKEN = $env:CLOUDFLARE_API_TOKEN }

if (-not $ACCOUNT_ID -or -not $API_TOKEN) {
    Write-Host "[ERROR] Missing CLOUDFLARE_ACCOUNT_ID or CF_API_TOKEN/CLOUDFLARE_API_TOKEN" -ForegroundColor Red
    exit 1
}

$BASE = "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/browser-rendering"
$HEADERS = @{
    'Authorization' = "Bearer $API_TOKEN"
    'Content-Type'  = 'application/json'
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CF Browser Rendering REST API - Live Test"
Write-Host "  Base URL: $BASE"
Write-Host "  Account: $($ACCOUNT_ID.Substring(0,8))..."
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Endpoint,
        [hashtable]$Body,
        [string]$ExpectedType  # 'json' or 'binary'
    )
    
    $url = "$BASE/$Endpoint"
    Write-Host "--- Test: $Name ---" -ForegroundColor Yellow
    Write-Host "  POST $url"
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $bodyJson = $Body | ConvertTo-Json -Depth 10
        
        if ($ExpectedType -eq 'binary') {
            # For binary endpoints, save to temp file
            $tempFile = [System.IO.Path]::GetTempFileName()
            $response = Invoke-WebRequest -Uri $url -Method POST -Headers $HEADERS -Body $bodyJson -OutFile $tempFile -PassThru -ErrorAction Stop
            $stopwatch.Stop()
            $statusCode = $response.StatusCode
            $browserMs = $response.Headers['X-Browser-Ms-Used']
            $fileSize = (Get-Item $tempFile).Length
            Remove-Item $tempFile -Force
            
            Write-Host "  Status: $statusCode | Size: $fileSize bytes | Browser: ${browserMs}ms | Total: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
            $script:passed++
            $script:results += [PSCustomObject]@{ Name=$Name; Status='PASS'; Code=$statusCode; Time="$($stopwatch.ElapsedMilliseconds)ms"; BrowserMs=$browserMs; Size=$fileSize }
        } else {
            $response = Invoke-RestMethod -Uri $url -Method POST -Headers $HEADERS -Body $bodyJson -ErrorAction Stop
            $stopwatch.Stop()
            
            $preview = ($response | ConvertTo-Json -Depth 3 -Compress).Substring(0, [Math]::Min(200, ($response | ConvertTo-Json -Depth 3 -Compress).Length))
            Write-Host "  Status: 200 | Total: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
            Write-Host "  Preview: $preview..." -ForegroundColor DarkGray
            $script:passed++
            $script:results += [PSCustomObject]@{ Name=$Name; Status='PASS'; Code=200; Time="$($stopwatch.ElapsedMilliseconds)ms"; BrowserMs='N/A'; Size='N/A' }
        }
    }
    catch {
        $stopwatch.Stop()
        $statusCode = 'N/A'
        $errorMsg = $_.Exception.Message
        
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        Write-Host "  Status: $statusCode | Error: $errorMsg | Time: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Red
        $script:failed++
        $script:results += [PSCustomObject]@{ Name=$Name; Status='FAIL'; Code=$statusCode; Time="$($stopwatch.ElapsedMilliseconds)ms"; BrowserMs='N/A'; Size=$errorMsg }
    }
    
    Write-Host ""
}

# --- Test 1: /content ---
Test-Endpoint -Name "1. /content (HTML)" -Endpoint "content" -Body @{ url = "https://example.com" } -ExpectedType "json"

# --- Test 2: /screenshot ---
Test-Endpoint -Name "2. /screenshot (PNG)" -Endpoint "screenshot" -Body @{ url = "https://example.com" } -ExpectedType "binary"

# --- Test 3: /screenshot (full page + viewport) ---
Test-Endpoint -Name "3. /screenshot (fullPage)" -Endpoint "screenshot" -Body @{
    url = "https://example.com"
    screenshotOptions = @{ fullPage = $true }
    viewport = @{ width = 1280; height = 720 }
    gotoOptions = @{ waitUntil = "networkidle0"; timeout = 45000 }
} -ExpectedType "binary"

# --- Test 4: /pdf ---
Test-Endpoint -Name "4. /pdf (A4)" -Endpoint "pdf" -Body @{
    url = "https://example.com"
    pdfOptions = @{ format = "a4"; printBackground = $true }
} -ExpectedType "binary"

# --- Test 5: /markdown ---
Test-Endpoint -Name "5. /markdown" -Endpoint "markdown" -Body @{ url = "https://example.com" } -ExpectedType "json"

# --- Test 6: /snapshot ---
Test-Endpoint -Name "6. /snapshot" -Endpoint "snapshot" -Body @{ url = "https://example.com" } -ExpectedType "json"

# --- Test 7: /scrape ---
Test-Endpoint -Name "7. /scrape (h1 + a)" -Endpoint "scrape" -Body @{
    url = "https://example.com"
    elements = @(
        @{ selector = "h1" }
        @{ selector = "a" }
    )
} -ExpectedType "json"

# --- Test 8: /links ---
Test-Endpoint -Name "8. /links" -Endpoint "links" -Body @{ url = "https://example.com" } -ExpectedType "json"

# --- Test 9: /json (AI extraction) ---
Test-Endpoint -Name "9. /json (AI)" -Endpoint "json" -Body @{
    url = "https://example.com"
    prompt = "Extract the page title and all links with their text"
} -ExpectedType "json"

# --- Test 10: /screenshot from HTML ---
Test-Endpoint -Name "10. /screenshot (HTML)" -Endpoint "screenshot" -Body @{
    html = "<html><body style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'><h1 style='color: white; text-align: center; padding: 100px;'>BAS - Brunella Agent System</h1></body></html>"
    screenshotOptions = @{ omitBackground = $false }
} -ExpectedType "binary"

# --- Summary ---
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RESULTS SUMMARY"
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Passed: $passed / $($passed + $failed)" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "  Failed: $failed / $($passed + $failed)" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
Write-Host ""

$results | Format-Table -AutoSize

if ($failed -eq 0) {
    Write-Host "[ALL PASS] CF Browser Rendering API is fully operational!" -ForegroundColor Green
} elseif ($passed -gt 0) {
    Write-Host "[PARTIAL] Some endpoints work, some need attention." -ForegroundColor Yellow
} else {
    Write-Host "[ALL FAIL] Browser Rendering API not accessible. Check:" -ForegroundColor Red
    Write-Host "  1. CF API token has 'Browser Rendering - Edit' permission" -ForegroundColor Red
    Write-Host "  2. Browser Rendering is enabled in CF Dashboard > Workers & Pages > Browser Rendering" -ForegroundColor Red
    Write-Host "  3. Your plan supports Browser Rendering (free tier available)" -ForegroundColor Red
}
