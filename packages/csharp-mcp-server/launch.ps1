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

# Ha WarmupOnly es a DLL mar letezik, ellenorizzuk, hogy nem fut-e mar a szerver.
# Ha a DLL zarolt (mas dotnet folyamat hasznalja), a szerver mar fut — ez OK.
if ($WarmupOnly -and (Test-Path $buildOutput)) {
  try {
    $fs = [System.IO.File]::Open($buildOutput, 'Open', 'ReadWrite', 'None')
    $fs.Close()
    $fs.Dispose()
    # Fajl nem zarolt — megprobalunk buildelni
    & dotnet build $projectPath --nologo -clp:ErrorsOnly 1>$null
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } catch [System.IO.IOException] {
    # DLL zarolt: a szerver mar fut, warmup sikeresnek tekintheto
    Write-Host "C# MCP server already running (DLL locked) - skipping rebuild."
    exit 0
  }
  exit 0
}

& dotnet build $projectPath --nologo -clp:ErrorsOnly 1>$null
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($WarmupOnly) {
  exit 0
}

& dotnet $buildOutput
exit $LASTEXITCODE
