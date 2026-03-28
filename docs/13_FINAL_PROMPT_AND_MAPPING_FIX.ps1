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
            'Megjegyzés' = '={{ $fromAI("AI_Note") }} | Telegram ID: {{ $node["Telegram_zenet"].json["message"]["from"]["id"] }}'
            'Nap Típusa' = 'Munkanap'
        }
        $node.parameters.columns.schema = @(
            @{ id='Dátum'; displayName='Dátum'; type='date' },
            @{ id='Ledolgozott Órák'; displayName='Ledolgozott Órák'; type='number' },
            @{ id='Projekt'; displayName='Projekt'; type='string' },
            @{ id='Munkaidõ Kezdete'; displayName='Munkaidõ Kezdete'; type='string' },
            @{ id='Munkaidõ Vége'; displayName='Munkaidõ Vége'; type='string' },
            @{ id='Megjegyzés'; displayName='Megjegyzés'; type='string' },
            @{ id='Nap Típusa'; displayName='Nap Típusa'; type='string' }
        )
        Set-TypecastTrue -Parameters $node.parameters
    }
    
    if ($node.name -eq 'Iszapfal_AI_Agent') {
        $node.parameters.options.systemMessage = @'
Te vagy az Iszapfaló Kft. intelligens belsõ asszisztense. Feladatod: Telegram üzenetekbõl adatok kinyerése és rögzítése.

### KÖTELEZÕ INSTRUKCIÓK MUNKAIDÕHÖZ (Munkaido_Rogzites tool):
Ha a felhasználó munkaidõt, munkát vagy terepet említ:
1. **Date**: A nap dátuma YYYY-MM-DD formátumban. Ha "ma", akkor a mai nap: {{ .toISO().split('T')[0] }}.
2. **Hours_Worked**: Hány órát dolgozott? Csak a számot add át (pl. 8 vagy 7.5). Ha idõintervallumot ad meg (pl. 8-tól 16-ig), számold ki a különbséget!
3. **Project**: A projekt, település vagy tó neve (pl. "Gödöllõ", "Balatonberény").
4. **StartTime**: A munka kezdete HH:mm formátumban (pl. 08:00).
5. **EndTime**: A munka vége HH:mm formátumban (pl. 16:30).
6. **AI_Note**: Minden egyéb fontos részlet az üzenetbõl.

### PÉLDA ÉRTELMEZÉSRE:
Üzenet: "Ma 8 órát dolgoztam a Gödöllõ projekten 7-tõl 15-ig"
-> Tool hívás: Date="2026-03-26", Hours_Worked=8, Project="Gödöllõ", StartTime="07:00", EndTime="15:00", AI_Note="8 órát dolgoztam"

Válaszolj mindig barátságosan magyarul a rögzítés után!
'@
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

Write-Host "KÉSZ! A dátum, óra, projekt és Chat ID (Megjegyzésbe fûzve) mezõk mostantól töltõdni fognak."
