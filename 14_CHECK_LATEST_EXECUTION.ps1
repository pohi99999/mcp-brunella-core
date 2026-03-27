$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

Write-Host "Lekérdezem a LEGÚJABB (1 db) futást a 02-es workflow-hoz..."
Write-Host "------------------------------------------------------------"

try {
    $executions = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions?workflowId=' + $wfId + '&limit=1') -Headers $headers
    
    if ($executions.data.Count -eq 0) {
        Write-Host "Nem található futás."
    } else {
        $exec = $executions.data[0]
        $statusColor = if ($exec.finished) { "Green" } else { "Red" }
        $statusText = if ($exec.finished) { "SIKERES" } else { "HIBA/FOLYAMATBAN" }
        
        Write-Host "Futás ID: " -NoNewline
        Write-Host $exec.id -ForegroundColor Cyan -NoNewline
        Write-Host " | Státusz: " -NoNewline
        Write-Host $statusText -ForegroundColor $statusColor -NoNewline
        Write-Host " | Indítva: $($exec.startedAt) | Befejezve: $($exec.stoppedAt)"
        
        # Bemásoljuk a Node-szintû eredményeket is (ha elérhetõek az API-n keresztül):
        # Mivel a /api/v1/executions nem adja vissza a teljes node data-t listázáskor,
        # megpróbáljuk beolvasni a specifikus /api/v1/executions/{id} végpontot.
        
        Write-Host "
Részletek letöltése az execution adataiból..."
        $details = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions/' + $exec.id) -Headers $headers
        
        $airtableData = $details.data.resultData.runData.Munkaido_Rogzites
        if ($airtableData) {
            Write-Host "
? Munkaido_Rogzites TOOL FUTOTT!" -ForegroundColor Green
            Write-Host "Visszaadott adatok az Airtable-tõl:"
            # Csak az elsõdleges outputot mutatjuk, amiben látszik, mit mentett el:
            $airtableData[0].data.main[0][0].json | Select-Object -Property id, fields | ConvertTo-Json -Depth 4
        } else {
            Write-Host "
? A Munkaido_Rogzites tool NEM futott le! (Vagy az AI nem azt hívta, vagy hiba történt elõtte)." -ForegroundColor Red
        }
        
        $agentData = $details.data.resultData.runData.Iszapfal_AI_Agent
        if ($agentData) {
            Write-Host "
?? AI Agent Válasz:" -ForegroundColor Blue
            Write-Host $agentData[0].data.main[0][0].json.output
        }
    }
} catch {
    Write-Host "Hiba a lekérdezés során: $($_.Exception.Message)" -ForegroundColor Red
}
