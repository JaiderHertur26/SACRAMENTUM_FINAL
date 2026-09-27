param(
  [string]$SourceZip = 'D:\SACRAMENTA.zip',
  [string]$OutputRoot = 'D:\SACRAMENTA_CANONICAL_EXPORT',
  [string]$StagingRoot = 'D:\SACRAMENTA_CANONICAL_STAGING'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (!(Test-Path -LiteralPath $SourceZip)) {
  throw "No existe el archivo fuente: $SourceZip"
}

if (Test-Path -LiteralPath $StagingRoot) {
  Remove-Item -LiteralPath $StagingRoot -Recurse -Force
}
if (Test-Path -LiteralPath $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead($SourceZip)
try {
  $entries = $zip.Entries | Where-Object {
    $_.Name -and $_.Name -match '\.(DBF|FPT)$'
  }

  foreach ($entry in $entries) {
    $relative = $entry.FullName -replace '/', '\'
    $target = Join-Path $StagingRoot $relative
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
  }

  Write-Host ("Archivos DBF/FPT extraídos: " + $entries.Count)
}
finally {
  $zip.Dispose()
}

$canonicalizer = Join-Path $PSScriptRoot 'dbf-canonicalizer.mjs'
if (!(Test-Path -LiteralPath $canonicalizer)) {
  throw "No existe el canonicalizador: $canonicalizer"
}
& node $canonicalizer $StagingRoot $OutputRoot $SourceZip
if ($LASTEXITCODE -ne 0) {
  throw "El canonicalizador terminó con código $LASTEXITCODE"
}

$manifest = Join-Path $OutputRoot 'manifest.json'
if (!(Test-Path -LiteralPath $manifest)) {
  throw 'No se generó manifest.json'
}

Write-Host ''
Write-Host 'Exportación canónica completa:' -ForegroundColor Green
Write-Host $OutputRoot
Write-Host 'Manifest:'
Write-Host $manifest
