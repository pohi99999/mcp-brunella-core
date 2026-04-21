# Brunella Context Syncer for Gemini App
$outputFile = "C:\Users\pohi9\OneDrive\Desktop\Bevételvadász\BRUNELLA_MASTER_CONTEXT.md"
$driveFile = "C:\Users\pohi9\OneDrive\Desktop\Bevételvadász\BRUNELLA_MASTER_CONTEXT.md" # OneDrive/Drive sync folder

" # 🧠 BRUNELLA MASTER CONTEXT - 2026-02-21 12:34" | Out-File -FilePath $outputFile -Encoding utf8
"---" | Out-File -Append -FilePath $outputFile -Encoding utf8

# Fájlok listája a beolvasáshoz
$files = @(
    "C:\Users\pohi9\OneDrive\Desktop\Bevételvadász\MASTER_INDEX.md",
    "C:\Users\pohi9\OneDrive\Desktop\palyazat\Brunella_Palyazati_Anyag\STRUCTURE_PLAN.md",
    "F:\mcp-brunella-core\README.md",
    "F:\mcp-brunella-core\.ai\FOSZAL.md",
    "F:\mcp-brunella-core\conductor\tracks.md"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        "## 📄 Source: $f" | Out-File -Append -FilePath $outputFile -Encoding utf8
        Get-Content $f | Out-File -Append -FilePath $outputFile -Encoding utf8
        "
---" | Out-File -Append -FilePath $outputFile -Encoding utf8
    }
}

Write-Host "Kontextus összeállítva: $outputFile" -ForegroundColor Green
