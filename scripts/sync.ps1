Set-Location -Path (Join-Path $PSScriptRoot '..')
& .\ops\scripts\sync.ps1 @args
exit $LASTEXITCODE
