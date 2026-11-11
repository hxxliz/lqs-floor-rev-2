[CmdletBinding()]
param(
  [string]$InstallerPath,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
if (-not $InstallerPath) { $InstallerPath = Join-Path $PSScriptRoot "LQ's Cutting Floor.exe" }

function Find-CuttingFloor {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'LQsCuttingFloor\LQsCuttingFloor.exe'),
    (Join-Path $env:LOCALAPPDATA "Programs\LQ's Cutting Floor\LQCuttingFloor.exe")
  )
  foreach ($root in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue) {
      $app = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($app.DisplayName -notlike '*Cutting Floor*' -or -not $app.InstallLocation) { continue }
      $candidates += Join-Path $app.InstallLocation 'LQsCuttingFloor.exe'
      $candidates += Join-Path $app.InstallLocation 'LQCuttingFloor.exe'
    }
  }
  $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -Unique
}

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '') }
    finally { $sha.Dispose() }
  } finally { $stream.Dispose() }
}

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$targetVersion = [version](Get-Item -LiteralPath $installer).VersionInfo.ProductVersion
$checksumFile = Join-Path (Split-Path -Parent $installer) 'SHA256SUMS.txt'
if (Test-Path -LiteralPath $checksumFile) {
  $expected = (Get-Content -LiteralPath $checksumFile | Where-Object { $_ -match "  LQ's Cutting Floor\.exe$" } | Select-Object -First 1) -replace '\s+.*$', ''
  if ($expected -and (Get-Sha256 $installer) -ne $expected) { throw 'The installer checksum does not match SHA256SUMS.txt. Download a fresh copy before updating.' }
}

$before = @(Find-CuttingFloor)
if ($before.Count) {
  $currentVersion = [version](Get-Item -LiteralPath $before[0]).VersionInfo.ProductVersion
  if ($currentVersion -gt $targetVersion) { throw "Installed version $currentVersion is newer than installer version $targetVersion. Download the latest release instead." }
  Write-Host "Found: $($before[0]) (version $currentVersion)"
} else { Write-Host 'No existing installation found; this will perform a first install.' }
Write-Host "Installer: $installer (version $targetVersion)"
if ($CheckOnly) { exit 0 }

$running = @(Get-Process -Name 'LQsCuttingFloor', 'LQCuttingFloor' -ErrorAction SilentlyContinue)
foreach ($process in $running) { [void]$process.CloseMainWindow() }
if ($running.Count) { Start-Sleep -Seconds 3 }
if (Get-Process -Name 'LQsCuttingFloor', 'LQCuttingFloor' -ErrorAction SilentlyContinue) { throw "LQ's Cutting Floor is still open. Save your work, close it, and run this updater again." }

$setup = Start-Process -FilePath $installer -Wait -PassThru
if ($setup.ExitCode -ne 0) { throw "The installer exited with code $($setup.ExitCode). Your existing installation was not manually changed." }

$after = @(Find-CuttingFloor)
if (-not $after.Count) { throw 'Setup finished, but the installed application could not be found in a standard location.' }
$installedVersion = [version](Get-Item -LiteralPath $after[0]).VersionInfo.ProductVersion
if ($installedVersion -lt $targetVersion) { throw "Setup finished, but version $installedVersion is still installed instead of $targetVersion." }
Write-Host "Updated: $($after[0]) (version $installedVersion)"
Start-Process -FilePath $after[0]
