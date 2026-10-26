# Installs a portable Windows build of Hermes Adaptive Routing for the current user.
# No administrator privilege required. Dry-run unless -Apply is supplied.
[CmdletBinding()]
param([switch] $Apply)
$ErrorActionPreference = "Stop"
$source = Join-Path $PSScriptRoot "app"
if (!(Test-Path -LiteralPath $source -PathType Container)) { throw "Missing package/app directory" }
$exe = Get-ChildItem -LiteralPath $source -Filter "Hermes*.exe" -File | Select-Object -First 1
if (!$exe) {
  $exe = Get-ChildItem -LiteralPath $source -Filter '*.exe' -File |
    Where-Object { $_.Name -notmatch '^(elevate|uninstall)' } | Select-Object -First 1
}
if (!$exe) { throw "Missing packaged Hermes executable" }
$programs = Join-Path $env:LOCALAPPDATA "Programs"
$target = Join-Path $programs "Hermes-Adaptive"
$targetExe = Join-Path $target $exe.Name
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $env:APPDATA "Hermes-Adaptive/shortcut-backups/$timestamp"
$shortcuts = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) "Hermes.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) "Hermes Desktop.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Programs')) "Hermes.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Programs')) "Hermes Desktop.lnk")
)
$existing = @($shortcuts | Where-Object { Test-Path -LiteralPath $_ })
Write-Host "Install source: $source"
Write-Host "Target executable: $targetExe"
Write-Host "Existing Hermes shortcuts to back up: $($existing.Count)"
$existing | ForEach-Object { Write-Host "Shortcut: $_" }
if (!$Apply) {
  Write-Host "DRY RUN. Re-run with -Apply after inspecting the target."
  exit 0
}
if (Get-Process -Name 'Hermes*' -ErrorAction SilentlyContinue) {
  throw "Close running Hermes Desktop windows before installing; Gateway on VPS is unaffected."
}
$staged = "$target.staged.$timestamp"
New-Item -ItemType Directory -Force -Path $programs | Out-Null
if (Test-Path -LiteralPath $staged) { throw "Staging path already exists: $staged" }
Copy-Item -LiteralPath $source -Destination $staged -Recurse
if (!(Test-Path -LiteralPath (Join-Path $staged $exe.Name))) { throw "Staged executable missing" }
$oldTarget = $null
if (Test-Path -LiteralPath $target) {
  $oldTarget = "$target.backup.$timestamp"
  Move-Item -LiteralPath $target -Destination $oldTarget
}
try {
  Move-Item -LiteralPath $staged -Destination $target
} catch {
  if ($oldTarget -and (Test-Path -LiteralPath $oldTarget) -and !(Test-Path -LiteralPath $target)) {
    Move-Item -LiteralPath $oldTarget -Destination $target
  }
  throw
}
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
foreach ($link in $existing) {
  $parentName = if ([System.IO.Path]::GetDirectoryName($link) -eq [Environment]::GetFolderPath("Desktop")) { "desktop" } else { "startmenu" }
  $safe = [System.IO.Path]::GetFileName($link)
  Copy-Item -LiteralPath $link -Destination (Join-Path $backupRoot "$parentName-$safe")
}
if ($existing.Count -eq 0) {
  $existing = @((Join-Path ([Environment]::GetFolderPath('Desktop')) "Hermes.lnk"))
}
$ws = New-Object -ComObject WScript.Shell
foreach ($link in $existing) {
  $item = $ws.CreateShortcut($link)
  $item.TargetPath = $targetExe
  $item.WorkingDirectory = $target
  $item.IconLocation = "$targetExe,0"
  $item.Description = 'Hermes Desktop - Adaptive Routing by profile'
  $item.Save()
  Write-Host "Updated shortcut: $link"
}
Write-Host "INSTALLED=$targetExe"
Write-Host "SHORTCUT_BACKUP=$backupRoot"
if ($oldTarget) { Write-Host "PREVIOUS_INSTALL_BACKUP=$oldTarget" }
Write-Host "NOTE: taskbar-pinned icons and MSIX app aliases are not changed."
