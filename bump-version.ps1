# Bump the service worker cache version, and keep the in-app version label in sync.
# Handles:   const VERSION = 'dq-v11';   const CACHE = 'dq-v11';
$ErrorActionPreference = 'Stop'
$sw = Join-Path $PSScriptRoot 'sw.js'
if (-not (Test-Path $sw)) { Write-Host '  [skip] sw.js not found'; exit 0 }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$c = Get-Content -Raw -Encoding UTF8 $sw
$rx = "(?m)^(\s*const\s+(?:CACHE|VERSION)\s*=\s*')([A-Za-z]+)-v(\d+)(';)"
$m = [regex]::Match($c, $rx)
if (-not $m.Success) { Write-Host '  [skip] no version line found in sw.js'; exit 0 }

$name = $m.Groups[2].Value
$n    = [int]$m.Groups[3].Value + 1
$c = [regex]::Replace($c, $rx, ('${1}${2}-v' + $n + '${4}'))
[System.IO.File]::WriteAllText($sw, $c, $utf8)
Write-Host "  sw.js  -> $name-v$n"

# Keep the Settings screen showing the same number
$idx = Join-Path $PSScriptRoot 'index.html'
if (Test-Path $idx) {
  $h  = Get-Content -Raw -Encoding UTF8 $idx
  $rx2 = "(const\s+APPVER\s*=\s*')" + [regex]::Escape($name) + "-v\d+(')"
  if ([regex]::IsMatch($h, $rx2)) {
    $h = [regex]::Replace($h, $rx2, ('${1}' + $name + '-v' + $n + '${2}'))
    [System.IO.File]::WriteAllText($idx, $h, $utf8)
    Write-Host "  index.html APPVER -> $name-v$n"
  }
}

# GitHub Pages: skip Jekyll entirely. Plain static files, faster and fewer build failures.
$nj = Join-Path $PSScriptRoot '.nojekyll'
if (-not (Test-Path $nj)) {
  [System.IO.File]::WriteAllText($nj, '', $utf8)
  Write-Host '  created .nojekyll (tells GitHub Pages to serve files as-is)'
}
