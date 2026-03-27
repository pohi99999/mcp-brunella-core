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
    switch ($node.name) {
        'Munkaido_Rogzites' {
            $node.parameters.table.value = 'Munkaidõ Nyilvántartás'
            $node.parameters.columns.value = [ordered]@{
                'Dátum' = '={{ $fromAI("Date") || $now.toISO().split(''T'')[0] }}'
                'Munkaidõ Kezdete' = '={{ $fromAI("StartTime") || "" }}'
                'Projekt' = '={{ $fromAI("Project") || "" }}'
            }
            $node.parameters.columns.schema = @(
                @{ id='Dátum'; displayName='Dátum'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
                @{ id='Munkaidõ Kezdete'; displayName='Munkaidõ Kezdete'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Projekt'; displayName='Projekt'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false }
            )
            Set-TypecastTrue -Parameters $node.parameters
        }
        'Feladat_Letrehozas' {
            $node.parameters.table.value = 'MUNKAK'
            $node.parameters.columns.value = [ordered]@{
                'Feladat neve' = '={{ $fromAI("Work_Type") || "Új feladat" }}'
                'Státusz' = 'Várakozás'
                'Határidõ' = '={{ $fromAI("Deadline") || $now.toISO().split(''T'')[0] }}'
                'Leírás' = '={{ $fromAI("Task_Description") || "Nincs leírás" }}'
            }
            $node.parameters.columns.schema = @(
                @{ id='Feladat neve'; displayName='Feladat neve'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Státusz'; displayName='Státusz'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Határidõ'; displayName='Határidõ'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
                @{ id='Leírás'; displayName='Leírás'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false }
            )
            Set-TypecastTrue -Parameters $node.parameters
        }
        'Koltseg_Rogzites' {
            $node.parameters.table.value = 'KOLTSEGEK'
            $node.parameters.columns.value = [ordered]@{
                'Dátum' = '={{ $fromAI("Date") || $now.toISO().split(''T'')[0] }}'
                'Összeg' = '={{ $fromAI("Amount") }}'
                'Pénznem' = '={{ $fromAI("Currency") || "Ft" }}'
                'Típus' = '={{ $fromAI("Cost_Type") || "Egyéb" }}'
                'Leírás' = '={{ $fromAI("Note") || "Költség rögzítve" }}'
            }
            $node.parameters.columns.schema = @(
                @{ id='Dátum'; displayName='Dátum'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
                @{ id='Összeg'; displayName='Összeg'; required=$false; defaultMatch=$false; display=$true; type='number'; readOnly=$false },
                @{ id='Pénznem'; displayName='Pénznem'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Típus'; displayName='Típus'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Leírás'; displayName='Leírás'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false }
            )
            Set-TypecastTrue -Parameters $node.parameters
        }
        'Szabadsag_Rogzites' {
            $node.parameters.table.value = 'Szabadságok'
            $node.parameters.columns.value = [ordered]@{
                'Szabadság Megnevezés' = '={{ $fromAI("Reason") || "Szabadság" }}'
                'Kezdõ Dátum' = '={{ $fromAI("Start_Date") || $now.toISO().split(''T'')[0] }}'
                'Befejezés Dátuma' = '={{ $fromAI("End_Date") || $now.toISO().split(''T'')[0] }}'
                'Szabadság Típusa' = 'Kivett'
                'Megjegyzés' = '={{ $fromAI("Reason") || "Szabadság rögzítve" }}'
            }
            $node.parameters.columns.schema = @(
                @{ id='Szabadság Megnevezés'; displayName='Szabadság Megnevezés'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Kezdõ Dátum'; displayName='Kezdõ Dátum'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
                @{ id='Befejezés Dátuma'; displayName='Befejezés Dátuma'; required=$false; defaultMatch=$false; display=$true; type='date'; readOnly=$false },
                @{ id='Szabadság Típusa'; displayName='Szabadság Típusa'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false },
                @{ id='Megjegyzés'; displayName='Megjegyzés'; required=$false; defaultMatch=$false; display=$true; type='string'; readOnly=$false }
            )
            Set-TypecastTrue -Parameters $node.parameters
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

Write-Host "SIKER! N8N Workflow API PATCH lefutott az Airtable táblák valós sémája alapján."
