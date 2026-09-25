param([Parameter(Mandatory=$true)][string]$SqlFile)
$ErrorActionPreference='Stop'
$dbUrl=(Get-Content 'C:\SACRAMENTUM\SACRAMENTUM_FINAL\supabase\.temp\pooler-url' -Raw).Trim()
Push-Location 'C:\SACRAMENTUM\SACRAMENTUM_FINAL'
try {
  & npx supabase db query --db-url $dbUrl --file $SqlFile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
