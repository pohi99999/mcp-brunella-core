$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }
$backupFile = 'F:\mcp-brunella-core\.worktrees\004_Iszapfaló_n8n\N8N_PRO\api_live_audit\02_CAEaN0ryx5POpVSv_pre_columns_prompt_fix_20260326.json'

Write-Host "Visszaállítom a 02-es workflow-t a biztonsági mentésbõl..."
try {
    $backupContent = Get-Content $backupFile -Raw -Encoding UTF8
    # Cseréljük le az egészet a mentésre
    $null = Invoke-RestMethod -Method Put -Uri ($base + '/api/v1/workflows/' + $wfId) -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $backupContent
    Write-Host "VISSZAÁLLÍTÁS SIKERES! A workflow most újra a mûködõ állapotban van." -ForegroundColor Green
} catch {
    Write-Host "Hiba: $($_.Exception.Message)" -ForegroundColor Red
}
