[CmdletBinding()]
param(
  [string]$UserDataDir = 'C:\ChromeProfiles\AgentPersonal',
  [string]$ProfileName = 'Agent - Personal Gmail',
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

function New-DesktopShortcut {
  param([string]$LaunchBat, [string]$ChromePath)

  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not (Test-Path $desktop)) { throw 'Desktop folder not available.' }

  $shortcutPath = Join-Path $desktop 'Agent - Personal Gmail Chrome.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $LaunchBat
  $shortcut.WorkingDirectory = $PSScriptRoot
  $shortcut.Description = 'Agent - Personal Gmail Chrome'
  $shortcut.IconLocation = "$ChromePath,0"
  $shortcut.Save()
  return $shortcutPath
}

$chromePath = Resolve-ChromePath
New-Item -ItemType Directory -Path $UserDataDir -Force | Out-Null
$launchBat = Join-Path $PSScriptRoot 'launch-agent-chrome.bat'
$shortcutPath = New-DesktopShortcut -LaunchBat $launchBat -ChromePath $chromePath

Write-Host "Chrome found: $chromePath"
Write-Host "Agent profile folder ready: $UserDataDir"
Write-Host "Desktop shortcut created: $shortcutPath"
Write-Host "Sign-in required: $AccountEmail"
Write-Host 'Do not add another Google account on the first pass.'
