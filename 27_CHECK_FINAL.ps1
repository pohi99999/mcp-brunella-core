$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

Write-Host "Lekérdezem a LEGÚJABB futást a 02-es workflow-hoz..."
try {
    $executions = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions?workflowId=' + $wfId + '&limit=1') -Headers $headers
    if ($executions.data.Count -gt 0) {
        $exec = $executions.data[0]
        $statusStr = if ($exec.finished) { 'SIKERES' } else { 'HIBA/FOLYAMATBAN' }
        Write-Host "Futás ID: $($exec.id) | Státusz: $statusStr" -ForegroundColor Cyan
        
        $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $exec.id) -Headers $headers
        
        if ($details.data.resultData.error) {
             Write-Host "
HIBA A FUTÁSBAN:" -ForegroundColor Red
             $details.data.resultData.error | ConvertTo-Json -Depth 4
        }
        
        $airtableData = $details.data.resultData.runData.Munkaido_Rogzites
        if ($airtableData) {
            Write-Host "
? Munkaido_Rogzites TOOL FUTOTT!" -ForegroundColor Green
            Write-Host "Mentett adatok (Airtable válasza):"
            $airtableData[0].data.main[0][0].json.fields | ConvertTo-Json -Depth 4
        } else {
            Write-Host "
? A Munkaido_Rogzites tool NEM futott le! Hiba vagy más ágra ment." -ForegroundColor Red
            
            # Nézzük meg, hogy mi volt a filter kimenete (ha volt)
            $filterData = $details.data.resultData.runData.Csak_Szoveges_Uzenet
            if ($filterData) {
                 Write-Host "Szûrõ futott. Talán nem ment át a szövegellenõrzésen."
            }
        }
        
        $agentData = $details.data.resultData.runData.Iszapfal_AI_Agent
        if ($agentData) {
            Write-Host "
?? AI Agent Válasz:" -ForegroundColor Blue
            Write-Host $agentData[0].data.main[0][0].json.output
        }
    } else {
        Write-Host "Nem találtam új futást."
    }
} catch {
    Write-Host "Hiba: $($_.Exception.Message)" -ForegroundColor Red
}
