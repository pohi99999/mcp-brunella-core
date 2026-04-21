param(
    [switch]$OpenBrowser = $true
)

$ErrorActionPreference = 'Stop'

function Test-Binary {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-AcpEntryPoint {
    $npmPrefix = (& npm prefix -g).Trim()
    if (-not $npmPrefix) {
        throw 'Nem sikerult lekerni az npm globalis prefixet.'
    }

    $entryPoint = Join-Path $npmPrefix 'node_modules\@zed-industries\claude-code-acp\dist\index.js'
    if (-not (Test-Path $entryPoint)) {
        throw "A Chrome ACP adapter entrypoint nem talalhato: $entryPoint"
    }

    return $entryPoint
}

if (-not (Test-Binary 'acp-proxy')) {
    Write-Error 'Az acp-proxy nem talalhato. Telepites: npm install -g @chrome-acp/proxy-server @anthropic-ai/claude-code @zed-industries/claude-code-acp'
}

if (-not (Test-Binary 'node')) {
    Write-Error 'A node nem talalhato. Telepites utan a Node.js-nek is elerhetonek kell lennie a PATH-ban.'
}

$entryPoint = Get-AcpEntryPoint

Write-Host '[Chrome ACP] Proxy inditasa...' -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', "acp-proxy --no-auth node `"$entryPoint`"" | Out-Null
Start-Sleep -Seconds 2

if ($OpenBrowser) {
    Start-Process 'http://localhost:9315'
}

Write-Host '[Chrome ACP] Kereso nyitva: http://localhost:9315' -ForegroundColor Green
