$ErrorActionPreference = 'Stop'

$envContent = Get-Content 'F:\mcp-brunella-core\.env' -Raw -Encoding UTF8
$n8nKey = if ($envContent -match 'N8N_API_KEY=(.+)') { $matches[1].Trim() } else { '' }
if (-not $n8nKey) { throw 'N8N_API_KEY not found in .env' }

$base = 'https://iszapfalo.app.n8n.cloud'
$wfId = 'CAEaN0ryx5POpVSv'
$headers = @{ 'X-N8N-API-KEY' = $n8nKey }

Write-Host "Lekérdezem a legutóbbi 5 futást a 02-es workflow-hoz ()..."
Write-Host "------------------------------------------------------------"

try {
    $executions = Invoke-RestMethod -Method Get -Uri ($base + '/api/v1/executions?workflowId=' + $wfId + '&limit=5') -Headers $headers
    
    if ($executions.data.Count -eq 0) {
        Write-Host "Nem található egyetlen futás sem a közelmúltból."
    } else {
        foreach ($exec in $executions.data) {
            $statusColor = if ($exec.finished) { "Green" } else { "Red" }
            $statusText = if ($exec.finished) { "SIKERES" } else { "HIBA/FOLYAMATBAN" }
            
            Write-Host "Futás ID: " -NoNewline
            Write-Host $exec.id -ForegroundColor Cyan -NoNewline
            Write-Host " | Státusz: " -NoNewline
            Write-Host $statusText -ForegroundColor $statusColor -NoNewline
            Write-Host " | Indítva: $($exec.startedAt) | Befejezve: $($exec.stoppedAt)"
            
            if (-not $exec.finished -and $exec.status -eq 'error') {
                 Write-Host "  -> HIBA OKA: Általában node error (Nézd meg n8n UI-on a részletekért)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "Hiba a lekérdezés során: $($_.Exception.Message)" -ForegroundColor Red
}
