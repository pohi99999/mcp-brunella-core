# ===========================================
# Brunella D1 Auto-Setup (Non-Interactive)
# For CI/CD and automation
# ===========================================

param(
    [Parameter(Mandatory=$false)]
    [string]$D1_ID = "d1_placeholder_dev_keep_updating"
)

Write-Host ""
Write-Host "D1 Configuration - Automatic Setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Using D1_ID: $D1_ID" -ForegroundColor Yellow
Write-Host ""

# Worker list
$workers = @(
    @{ path = "myai/agents/workers/cean-test"; name = "cean-test"; type = "uncomment" },
    @{ path = "myai/agents/workers/research-agent"; name = "research-agent"; type = "replace" },
    @{ path = "myai/agents/workers/grant-monitor"; name = "grant-monitor"; type = "replace" }
)

Write-Host "Step 1: Updating Workers" -ForegroundColor Green
Write-Host ""

foreach ($worker in $workers) {
    $tomlFile = Join-Path $worker.path "wrangler.toml"
    
    if (Test-Path $tomlFile) {
        Write-Host ("  " + $worker.name) -ForegroundColor Cyan -NoNewline
        
        $backup = "$tomlFile.backup"
        Copy-Item $tomlFile $backup -Force
        
        $content = Get-Content $tomlFile -Raw
        
        if ($worker.type -eq "uncomment") {
            $content = $content -replace '# \[\[d1_databases\]\]', '[[d1_databases]]'
            $content = $content -replace '# binding = "DB"', 'binding = "DB"'
            $content = $content -replace '# database_name = "bas-metadata"', 'database_name = "bas-metadata"'
            $content = $content -replace '# database_id = "YOUR_DB_ID"', ('database_id = "' + $D1_ID + '"')
        }
        else {
            $content = $content -replace 'database_id = "UPDATE_WITH_YOUR_D1_ID"', ('database_id = "' + $D1_ID + '"')
        }
        
        Set-Content $tomlFile $content -Encoding UTF8
        Write-Host " ... OK" -ForegroundColor Green
    }
    else {
        Write-Host ("  " + $worker.name + " ... NOT FOUND") -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Step 2: Building" -ForegroundColor Green

Set-Location "f:\mcp-brunella-core"
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Build ... OK" -ForegroundColor Green
}
else {
    Write-Host "  Build ... WARNING" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
Write-Host "  D1_ID: $D1_ID"
Write-Host "  Workers: 3 updated"
Write-Host ""
