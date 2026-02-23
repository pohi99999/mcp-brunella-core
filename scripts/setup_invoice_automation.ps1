# BAS Invoice Automation Setup Script
# 2026-02-23

Write-Host "--- Brunella Agent System: Invoice to Sheets Setup ---" -ForegroundColor Cyan

$sheetId = Read-Host "Kérlek, add meg a cél Google Sheets ID-ját"
$gmailLabel = Read-Host "Kérlek, add meg a figyelt Gmail label nevét (pl. SZAMLA)"

if (-not $sheetId) {
    Write-Error "A Spreadsheet ID kötelező!"
    exit
}

# .env fájl frissítése
$envPath = ".env"
if (Test-Path $envPath) {
    $content = Get-Content $envPath
    $newContent = @()
    $foundSheet = $false
    
    foreach ($line in $content) {
        if ($line -like "INVOICE_SPREADSHEET_ID=*") {
            $newContent += "INVOICE_SPREADSHEET_ID=$sheetId"
            $foundSheet = $true
        } else {
            $newContent += $line
        }
    }
    
    if (-not $foundSheet) {
        $newContent += "INVOICE_SPREADSHEET_ID=$sheetId"
    }
    
    $newContent | Set-Content $envPath
    Write-Host "✅ .env fájl frissítve (INVOICE_SPREADSHEET_ID)." -ForegroundColor Green
} else {
    "INVOICE_SPREADSHEET_ID=$sheetId" | Set-Content $envPath
    Write-Host "✅ .env fájl létrehozva." -ForegroundColor Green
}

Write-Host "`nSetup befejeződött!" -ForegroundColor Cyan
Write-Host "Most már indíthatod a FinanceGuardian ágenst a Gmail feldolgozáshoz."
