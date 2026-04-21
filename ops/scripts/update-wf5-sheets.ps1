$sheetsId = "1A78ojE_3SvVQJst9xJUKHHLgeFrSpq2vvpAXEAml_fg"
$envLines = Get-Content "F:\mcp-brunella-core\.env"
$token = ($envLines | Where-Object { $_ -match "^N8N_API_DEV=" } | Select-Object -First 1) -replace "^N8N_API_DEV=", ""

if (-not $token) {
    Write-Error "N8N_API_DEV token nem talalhato .env-ben"
    exit 1
}

$hdr = @{
    "X-N8N-API-KEY" = $token
    "Content-Type"  = "application/json"
}

Write-Host "[1] WF-5 lekerese..."
$wf = Invoke-RestMethod "http://localhost:5678/api/v1/workflows/nSAbDCRqqAAUCGIF" -Headers $hdr
Write-Host "    Nev: $($wf.name)"

Write-Host "[2] Google Sheets node ID frissitese: $sheetsId"
$wf.nodes | Where-Object { $_.type -eq "n8n-nodes-base.googleSheets" } | ForEach-Object {
    $_.parameters.documentId.value = $sheetsId
    Write-Host "    Node: $($_.name) -> $sheetsId"
}

Write-Host "[3] Workflow mentese API-n..."
$body = @{
    name        = $wf.name
    nodes       = $wf.nodes
    connections = $wf.connections
    settings    = $wf.settings
} | ConvertTo-Json -Depth 25

$r = Invoke-RestMethod "http://localhost:5678/api/v1/workflows/nSAbDCRqqAAUCGIF" -Method PUT -Headers $hdr -Body $body
$newId = ($r.nodes | Where-Object { $_.type -eq "n8n-nodes-base.googleSheets" }).parameters.documentId.value
Write-Host "    Elmentett ID: $newId"

Write-Host "[4] WF-5 aktivalas (PATCH active:true)..."
$patchHdr = @{
    "X-N8N-API-KEY" = $token
    "Content-Type"  = "application/json"
}
$activateBody = '{"active":true}'
$activated = Invoke-RestMethod "http://localhost:5678/api/v1/workflows/nSAbDCRqqAAUCGIF" -Method PATCH -Headers $patchHdr -Body $activateBody
Write-Host "    Aktiv: $($activated.active)"

Write-Host ""
Write-Host "=== KESZ! WF-5 aktiv, Sheets ID be van allitva ==="
