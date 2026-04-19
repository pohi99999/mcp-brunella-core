$key = (Get-Content "F:\mcp-brunella-core\_br_temp\n8n_api_key.txt").Trim()
$headers = @{"X-N8N-API-KEY"=$key; "Content-Type"="application/json"}

# Load full workflow
$wf = Get-Content "F:\mcp-brunella-core\_br_temp\wf06_detail.json" -Raw | ConvertFrom-Json

# Fix the broken expression in Send_a_text_message node
$fixCount = 0
foreach ($node in $wf.nodes) {
    if ($node.id -eq "75c8ede7-dcaf-4369-8a3c-d72971868826") {
        $oldText = $node.parameters.text
        $node.parameters.text = "=A rendszer nem engedte tovabb a kovetkezo uzenetet, mert veszelyesnek iteltek: `${{ `$('Gmail_Trigger').item.json.snippet }}"
        Write-Host "FIX: $oldText -> $($node.parameters.text)"
        $fixCount++
    }
}
Write-Host "Fixed $fixCount nodes"

# Build the PATCH body - only send what's needed
$body = @{
    name = $wf.name
    nodes = $wf.nodes
    connections = $wf.connections
    settings = $wf.settings
    staticData = $wf.staticData
} | ConvertTo-Json -Depth 20 -Compress

Write-Host "Body length: $($body.Length)"

# Send the PATCH request
$resp = Invoke-RestMethod "https://iszapfalo.app.n8n.cloud/api/v1/workflows/LGvkbQNUm44UEoMi" -Method PUT -Headers $headers -Body $body
Write-Host "Response status: Success"
Write-Host "Workflow active: $($resp.active)"
