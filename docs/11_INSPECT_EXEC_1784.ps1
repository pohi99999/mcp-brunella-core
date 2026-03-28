$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

$execId = '1784'
Write-Host "Lekérdezem az 1784-es futás részleteit..."

try {
    $execDetails = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $execId) -Headers $headers
    
    $aiNode = $execDetails.data.resultData.runData.Iszapfal_AI_Agent
    if ($aiNode) {
        Write-Host "
--- AI Agent (Claude 3) Kimenete ---" -ForegroundColor Cyan
        $toolCall = $aiNode[0].data.main[0][0].json.toolCalls
        if ($toolCall) {
            $toolCall | ConvertTo-Json -Depth 5
        } else {
             Write-Host "Nem volt tool call a kimenetben!"
        }
    }
    
    $airtableNode = $execDetails.data.resultData.runData.Munkaido_Rogzites
    if ($airtableNode) {
        Write-Host "
--- Airtable Tool Bemenete ---" -ForegroundColor Yellow
        $airtableNode[0].data.main[0][0].json | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)" -ForegroundColor Red
}
