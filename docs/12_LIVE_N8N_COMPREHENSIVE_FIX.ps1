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
            'Projekt' = '={{ $fromAI("Project") || "" }}'
            'Munkahelyszín' = '={{ $fromAI("Location") || "" }}'
            'Munkaidõ Kezdete' = '={{ $fromAI("StartTime") || "" }}'
            'Munkaidõ Vége' = '={{ $fromAI("EndTime") || "" }}'
            'Nap Típusa' = 'Munkanap'
        }
        $node.parameters.columns.schema = @(
            @{ id='Dátum'; displayName='Dátum'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
            @{ id='Ledolgozott Órák'; displayName='Ledolgozott Órák'; required=$false; defaultMatch=$false; display=$true; type='number'; readOnly=$false },
            @{ id='Projekt'; displayName='Projekt'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
            @{ id='Munkahelyszín'; displayName='Munkahelyszín'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
            @{ id='Munkaidõ Kezdete'; displayName='Munkaidõ Kezdete'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
            @{ id='Munkaidõ Vége'; displayName='Munkaidõ Vége'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
            @{ id='Nap Típusa'; displayName='Nap Típusa'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false }
        )
        Set-TypecastTrue -Parameters $node.parameters
    }
    
    if ($node.name -eq 'Iszapfal_AI_Agent') {
        $node.parameters.options.systemMessage = @'
Te vagy az Iszapfaló Kft. intelligens belsõ asszisztense. A feladatod a Telegram üzenetek értelmezése és rögzítése.

1. MUNKAIDÕ RÖGZÍTÉS (Munkaido_Rogzites)
Keress: munkaidõ, kezdés, befejezés, "dolgoztam", "terepeztem".
- Date: YYYY-MM-DD (Ha "ma", akkor a mai nap: {{ .toISO().split('T')[0] }})
- Hours_Worked: Szám (pl. 8, 4.5).
- StartTime: HH:mm formátum (pl. 08:00)
- EndTime: HH:mm formátum (pl. 17:00)
- Project: A projekt vagy tó neve (pl. Balaton, Gödöllõ)
- Location: Helyszín (ha eltér a projekttõl)

2. FELADAT LÉTREHOZÁS (Feladat_Letrehozas)
- Work_Type: a munka rövid neve (ez lesz a 'Feladat neve' oszlopban)
- Task_Description: részletes leírás
- Deadline: YYYY-MM-DD

3. KÖLTSÉG RÖGZÍTÉS (Koltseg_Rogzites)
- Amount: pontos szám (pl. 8000)
- Cost_Type: Üzemanyag | Anyag | Étkezés | Egyéb
- Currency: Ft
- Note: Részletek (pl. "Tankolás a MOL-nál")

4. SZABADSÁG RÖGZÍTÉS (Szabadsag_Rogzites)
- Start_Date, End_Date: YYYY-MM-DD
- Reason: Indok (pl. Betegség, Szabadság)

Minden esetben adj egy rövid, barátságos választ a felhasználónak magyarul, pl: "Rendben, rögzítettem: 8 óra a Gödöllõ projekten!"
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

Write-Host "SIKER! N8N Munkaido_Rogzites finomhangolás (Összes séma mezõ és Prompt) elkészült."
