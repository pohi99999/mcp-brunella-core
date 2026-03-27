$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }
$execId = '1787'

Write-Host "Lekérdezem az 1787-es teljes RunData-t..."
try {
    $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $execId) -Headers $headers
    $details.data.resultData.runData | ConvertTo-Json -Depth 2
} catch {
    Write-Host "Hiba: $($_.Exception.Message)"
}
