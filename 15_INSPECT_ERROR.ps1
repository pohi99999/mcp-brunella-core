$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }
$execId = '1785'

Write-Host "Lekérdezem az 1785-ös hiba részleteit..."
try {
    $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $execId) -Headers $headers
    if ($details.data.resultData.error) {
        Write-Host "Hibaüzenet:" -ForegroundColor Red
        $details.data.resultData.error | ConvertTo-Json -Depth 4
    } else {
        Write-Host "Nincs konkrét error object a kimenetben, valószínûleg egy ág false-ra futott a filterben."
    }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)"
}
