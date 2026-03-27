$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }
$execId = '1787'

Write-Host "Lekérdezem az 1787-es hiba részleteit..."
try {
    $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $execId) -Headers $headers
    $errorObj = $details.data.resultData.error
    if ($errorObj) {
        Write-Host "Hibaüzenet:" -ForegroundColor Red
        $errorObj | ConvertTo-Json -Depth 4
    } else {
        Write-Host "Nincs konkrét error object a kimenetben, filter dobta el."
        Write-Host "
Csekkoljuk a filter node kimenetét:" -ForegroundColor Yellow
        $details.data.resultData.runData.Csak_Szoveges_Uzenet | ConvertTo-Json -Depth 4
    }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)"
}
