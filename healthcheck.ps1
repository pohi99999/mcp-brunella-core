# MCP Brunella Core Health Check Script (Windows)
# Run this script to diagnose the MCP server health

Write-Host "=== MCP Brunella Core Health Check ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found!" -ForegroundColor Red
}

# Check npm version
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found!" -ForegroundColor Red
}

# Check TypeScript
Write-Host "Checking TypeScript..." -ForegroundColor Yellow
try {
    $tscVersion = npx tsc --version
    Write-Host "✓ TypeScript version: $tscVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ TypeScript not found!" -ForegroundColor Red
}

# Check if node_modules exists
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✓ node_modules directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ node_modules not found! Run 'npm install'" -ForegroundColor Red
}

# Check if build directory exists
Write-Host "Checking build..." -ForegroundColor Yellow
if (Test-Path "build") {
    Write-Host "✓ build directory exists" -ForegroundColor Green
    $buildFiles = (Get-ChildItem "build" -Recurse -File).Count
    Write-Host "  Found $buildFiles files in build" -ForegroundColor Gray
} else {
    Write-Host "✗ build directory not found! Run 'npm run build'" -ForegroundColor Red
}

# Check logs directory
Write-Host "Checking logs..." -ForegroundColor Yellow
if (Test-Path "logs") {
    Write-Host "✓ logs directory exists" -ForegroundColor Green
    $logFiles = Get-ChildItem "logs" -File
    Write-Host "  Found $($logFiles.Count) log file(s)" -ForegroundColor Gray
    foreach ($log in $logFiles) {
        $size = [math]::Round($log.Length / 1KB, 2)
        Write-Host "    - $($log.Name): ${size}KB" -ForegroundColor Gray
    }
} else {
    Write-Host "! logs directory not found (will be created on first run)" -ForegroundColor Yellow
}

# Check config files
Write-Host "Checking configuration..." -ForegroundColor Yellow
if (Test-Path "config.yaml") {
    Write-Host "✓ config.yaml found" -ForegroundColor Green
} else {
    Write-Host "! config.yaml not found" -ForegroundColor Yellow
}

if (Test-Path ".env") {
    Write-Host "✓ .env found" -ForegroundColor Green
} else {
    Write-Host "! .env not found (using defaults)" -ForegroundColor Yellow
}

# Check package.json
Write-Host "Checking package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "✓ package.json found" -ForegroundColor Green
    $package = Get-Content "package.json" | ConvertFrom-Json
    Write-Host "  Name: $($package.name)" -ForegroundColor Gray
    Write-Host "  Version: $($package.version)" -ForegroundColor Gray
} else {
    Write-Host "✗ package.json not found!" -ForegroundColor Red
}

# Check disk space
Write-Host "Checking disk space..." -ForegroundColor Yellow
$drive = (Get-Location).Drive
$freeSpace = [math]::Round($drive.Free / 1GB, 2)
$totalSpace = [math]::Round(($drive.Free + $drive.Used) / 1GB, 2)
$percentFree = [math]::Round(($drive.Free / ($drive.Free + $drive.Used)) * 100, 2)
Write-Host "  Drive $($drive.Name): ${freeSpace}GB free of ${totalSpace}GB (${percentFree}%)" -ForegroundColor Gray

if ($percentFree -lt 10) {
    Write-Host "  ⚠ Low disk space!" -ForegroundColor Red
} elseif ($percentFree -lt 20) {
    Write-Host "  ! Disk space getting low" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Disk space OK" -ForegroundColor Green
}

# Check system resources
Write-Host "Checking system resources..." -ForegroundColor Yellow
$cpu = Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average
Write-Host "  CPU: $([math]::Round($cpu.Average, 2))% average load" -ForegroundColor Gray

$os = Get-WmiObject Win32_OperatingSystem
$totalRAM = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeRAM = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
$usedRAM = $totalRAM - $freeRAM
$ramPercent = [math]::Round(($usedRAM / $totalRAM) * 100, 2)
Write-Host "  RAM: ${usedRAM}GB used of ${totalRAM}GB (${ramPercent}%)" -ForegroundColor Gray

# Final summary
Write-Host ""
Write-Host "=== Health Check Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "  1. Run 'npm install' to install dependencies" -ForegroundColor White
}

if (-not (Test-Path "build")) {
    Write-Host "  2. Run 'npm run build' to compile TypeScript" -ForegroundColor White
}

if (-not (Test-Path ".env")) {
    Write-Host "  3. Copy .env.example to .env and configure" -ForegroundColor White
}

Write-Host ""
Write-Host "To start the server: npm start" -ForegroundColor Cyan
Write-Host "To run in dev mode: npm run dev" -ForegroundColor Cyan
Write-Host ""
