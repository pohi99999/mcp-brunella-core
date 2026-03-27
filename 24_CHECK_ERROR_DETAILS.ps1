$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

Write-Host "Lekérdezem a 1789-es hiba részleteit..."
try {
    $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/1789') -Headers $headers
    if ($details.data.resultData.error) {
        Write-Host "
Hibaüzenet (error object):" -ForegroundColor Red
        $details.data.resultData.error | ConvertTo-Json -Depth 4
    } else {
        Write-Host "Nincs error object."
    }
    
    Write-Host "
Lefutott Node-ok:" -ForegroundColor Yellow
    $details.data.resultData.runData.PSObject.Properties.Name | ForEach-Object { Write-Host "- $_" }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)"
}
