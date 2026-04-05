#!/usr/bin/env pwsh
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$payloadPath = Join-Path $scriptDir 'sample_payload.json'
if (-not (Test-Path $payloadPath)) {
  Write-Error "Payload not found: $payloadPath"
  exit 2
}
$payload = Get-Content -Raw -Path $payloadPath
$webhookUrl = 'http://localhost:5678/webhook/kkv-followup'
Write-Host "Sending sample payload to $webhookUrl"
try {
  $response = Invoke-RestMethod -Uri $webhookUrl -Method POST -ContentType 'application/json' -Body $payload -ErrorAction Stop
  Write-Host "Response:`n" ($response | ConvertTo-Json -Depth 5)
} catch {
  Write-Error "Request failed: $_"
  exit 1
}
exit 0
