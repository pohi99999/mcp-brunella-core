$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$PythonPort = if ($env:BRUNELLA_PYTHON_PORT) { $env:BRUNELLA_PYTHON_PORT } else { "8000" }
$PythonCandidates = @(
    (Join-Path $RepoRoot "myai\.venv\Scripts\python.exe"),
    (Join-Path $RepoRoot ".venv\Scripts\python.exe"),
    (Join-Path $RepoRoot "mcp_env\Scripts\python.exe")
)

Set-Location (Join-Path $RepoRoot "myai")

foreach ($Candidate in $PythonCandidates) {
    if (Test-Path $Candidate) {
        & $Candidate -m uvicorn server:app --host 0.0.0.0 --port $PythonPort
        exit $LASTEXITCODE
    }
}

$UvCommand = Get-Command uv -ErrorAction SilentlyContinue
if ($UvCommand) {
    & $UvCommand.Source run uvicorn server:app --host 0.0.0.0 --port $PythonPort
    exit $LASTEXITCODE
}

$PythonCommand = Get-Command python.exe -ErrorAction Stop
& $PythonCommand.Source -m uvicorn server:app --host 0.0.0.0 --port $PythonPort
exit $LASTEXITCODE
