[CmdletBinding()]
param(
  [switch]$WarmupOnly
)

$ErrorActionPreference = 'Stop'

$serverRoot = $PSScriptRoot
$workspaceRoot = Split-Path -Parent $serverRoot
$projectPath = Join-Path $serverRoot 'src\CsharpMcpServer\CsharpMcpServer.csproj'
$buildOutput = Join-Path $serverRoot 'src\CsharpMcpServer\bin\Debug\net10.0\CsharpMcpServer.dll'

$env:MCP_WORKSPACE_ROOT = $workspaceRoot

& dotnet build $projectPath --nologo -clp:ErrorsOnly 1>$null
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($WarmupOnly) {
  exit 0
}

& dotnet $buildOutput
exit $LASTEXITCODE
