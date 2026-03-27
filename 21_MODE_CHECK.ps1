$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

Write-Host "Lekérdezem az utolsó 5 futás mode-ját..."
try {
    $executions = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions?workflowId=CAEaN0ryx5POpVSv&limit=5') -Headers $headers
    foreach ($exec in $executions.data) {
        Write-Host "Futás ID: $($exec.id) | Mode: $($exec.mode) | Status: $($exec.status)"
    }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)"
}
