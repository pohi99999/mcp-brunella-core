$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

$wf = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/workflows/' + $wfId) -Headers $headers

function Set-TypecastTrue {
    param($Parameters)
    if (-not $Parameters.options) { $Parameters.options = [pscustomobject]@{} }
    if ($Parameters.options.PSObject.Properties.Name -contains 'typecast') { $Parameters.options.typecast = $true }
    else { $Parameters.options | Add-Member -NotePropertyName typecast -NotePropertyValue $true }
}

foreach ($node in $wf.nodes) {
    if ($node.name -eq 'Munkaido_Rogzites') {
        $node.parameters.columns.value = [ordered]@{
            'Dátum' = '={{ $fromAI("Date") || $now.toISO().split(''T'')[0] }}'
            'Ledolgozott Órák' = '={{ $fromAI("Hours_Worked") }}'
            'Projekt' = '={{ $fromAI("Project") || "Ismeretlen projekt" }}'
            'Munkaidõ Kezdete' = '={{ $fromAI("StartTime") || "" }}'
            'Munkaidõ Vége' = '={{ $fromAI("EndTime") || "" }}'
            'Megjegyzés' = '={{ $fromAI("AI_Note") }}'
            'Nap Típusa' = 'Munkanap'
        }
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

Write-Host "QUICKFIX SIKERES! Levettem a hibát okozó Telegram ID lekérdezést a Munkaido_Rogzites toolból."
