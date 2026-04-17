[CmdletBinding()]
param(
  [string]$UserDataDir = 'C:\ChromeProfiles\AgentPersonal',
  [string]$ProfileName = 'Agent - Personal Gmail',
  [string]$StartUrl = 'https://accounts.google.com/',
  [string]$AccountEmail = 'peterpohankapersonal@gmail.com'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-ChromePath {
  $candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
  }

  $command = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  throw 'Chrome.exe not found in the typical locations.'
}

$chromePath = Resolve-ChromePath
New-Item -ItemType Directory -Path $UserDataDir -Force | Out-Null

Write-Host "Chrome found: $chromePath"
Write-Host "Agent profile folder ready: $UserDataDir"
Write-Host 'Launching Chrome in a separate instance...'
Write-Host "Sign-in required: $AccountEmail"
Write-Host 'Use only this account on the first pass.'

Start-Process -FilePath $chromePath -ArgumentList @(
  "--user-data-dir=`"$UserDataDir`"",
  "--profile-directory=`"$ProfileName`"",
  '--new-window',
  '--no-first-run',
  '--no-default-browser-check',
  $StartUrl
) -WorkingDirectory $PSScriptRoot
