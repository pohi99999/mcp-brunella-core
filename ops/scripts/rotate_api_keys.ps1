# PowerShell Script: API Key Rotation
# Purpose: Securely rotate API keys in .env file with backup and validation

param(
    [switch]$DryRun = $false,
    [switch]$Help = $false
)

if ($Help) {
    Write-Host @"
API Key Rotation Script
========================

Usage: .\rotate_api_keys.ps1 [-DryRun] [-Help]

Options:
  -DryRun    Simulate rotation without making changes
  -Help      Show this help message

This script will:
1. Create a backup of the current .env file
2. Prompt for new API keys (securely)
3. Validate key formats
4. Update the .env file with new keys
5. Verify the new configuration

"@
    exit 0
}

$envPath = Join-Path $PSScriptRoot ".." ".env"
$backupPath = Join-Path $PSScriptRoot ".." ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "🔐 Brunella API Key Rotation Tool" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Check if .env exists
if (-not (Test-Path $envPath)) {
    Write-Host "❌ Error: .env file not found at $envPath" -ForegroundColor Red
    exit 1
}

# Create backup
if (-not $DryRun) {
    Write-Host "📦 Creating backup: $backupPath" -ForegroundColor Green
    Copy-Item $envPath $backupPath
} else {
    Write-Host "📦 Would create backup: $backupPath" -ForegroundColor Yellow
}

# Define keys to rotate
$keysToRotate = @(
    @{Name="GEMINI_API_KEY"; Pattern="^AIza[0-9A-Za-z_-]{35}$"; Description="Google Gemini API Key (starts with AIza)"},
    @{Name="GITHUB_PERSONAL_ACCESS_TOKEN"; Pattern="^(ghp|github_pat)_[A-Za-z0-9_]{36,}$"; Description="GitHub Personal Access Token"},
    @{Name="OPENAI_API_KEY"; Pattern="^sk-[A-Za-z0-9]{48}$"; Description="OpenAI API Key (starts with sk-)"},
    @{Name="CLOUDFLARE_R2_SECRET_ACCESS_KEY"; Pattern="^[A-Za-z0-9+/]{40}$"; Description="Cloudflare R2 Secret Access Key"}
)

$newKeys = @{}

Write-Host "🔑 Please enter new API keys (leave blank to skip):" -ForegroundColor Cyan
Write-Host ""

foreach ($key in $keysToRotate) {
    Write-Host "  $($key.Description)" -ForegroundColor White
    $secureInput = Read-Host "  Enter new $($key.Name)" -AsSecureString
    
    if ($secureInput.Length -eq 0) {
        Write-Host "  ⏭️  Skipped" -ForegroundColor Yellow
        continue
    }
    
    # Convert SecureString to plain text for validation
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
    $plainKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    
    # Validate format
    if ($plainKey -match $key.Pattern) {
        $newKeys[$key.Name] = $plainKey
        Write-Host "  ✅ Valid format" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Invalid format! Expected pattern: $($key.Pattern)" -ForegroundColor Red
        Write-Host "  This key will NOT be updated." -ForegroundColor Red
    }
    Write-Host ""
}

if ($newKeys.Count -eq 0) {
    Write-Host "⚠️  No valid keys provided. Exiting." -ForegroundColor Yellow
    exit 0
}

# Update .env file
Write-Host "📝 Updating .env file..." -ForegroundColor Cyan

if (-not $DryRun) {
    $envContent = Get-Content $envPath
    
    foreach ($keyName in $newKeys.Keys) {
        $newValue = $newKeys[$keyName]
        $pattern = "^$keyName=.*$"
        $replacement = "$keyName=$newValue"
        
        $envContent = $envContent -replace $pattern, $replacement
    }
    
    Set-Content -Path $envPath -Value $envContent
    Write-Host "✅ .env file updated successfully" -ForegroundColor Green
} else {
    Write-Host "Would update the following keys:" -ForegroundColor Yellow
    foreach ($keyName in $newKeys.Keys) {
        Write-Host "  - $keyName" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 API Key Rotation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify the new keys work by running: npm run dev" -ForegroundColor White
Write-Host "  2. If successful, delete the backup: $backupPath" -ForegroundColor White
Write-Host "  3. If issues occur, restore from backup: Copy-Item $backupPath $envPath" -ForegroundColor White
