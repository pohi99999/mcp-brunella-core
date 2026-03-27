$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

$wf = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/workflows/' + $wfId) -Headers $headers

foreach ($node in $wf.nodes) {
    if ($node.type -eq 'n8n-nodes-base.airtableTool') {
        # Az n8n hibát okozhat a schema megadásnál (különösen a date vagy display opcióknál), 
        # ha nem a UI-ból történik a mezõ feltöltése.
        # Egyszerûsítem a schema-t az alapértékekre (csak a displayName, id, type) mindenhol 'string' típusra
        # mert az Airtable API Typecast-ja úgyis konvertálja.
        
        $newSchema = @()
        foreach ($col in $node.parameters.columns.value.PSObject.Properties) {
            $newSchema += @{
                id = $col.Name
                displayName = $col.Name
                type = 'string'
            }
        }
        $node.parameters.columns.schema = $newSchema
    }
}

$payload = [ordered]@{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
}

$body = $payload | ConvertTo-Json -Depth 100
$null = Invoke-RestMethod -Method Put -Uri ($base + '/api/v1/workflows/' + $wfId) -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body

Write-Host "JAVÍTÁS SIKERES! Sémák egyszerûsítve 'string'-re, n8n backend crash esélyesen megszüntetve."
