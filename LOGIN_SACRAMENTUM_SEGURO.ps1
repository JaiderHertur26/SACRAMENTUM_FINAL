Set-Location 'C:\SACRAMENTUM\SACRAMENTUM_FINAL'
Write-Host ''
Write-Host 'SACRAMENTUM - AUTENTICACION SUPABASE CLI' -ForegroundColor Cyan
Write-Host '1. En Firefox crea un Personal Access Token llamado SACRAMENTUM_CLI.' -ForegroundColor White
Write-Host '2. Copialo y pegalo aqui. El texto NO se mostrara en pantalla.' -ForegroundColor White
Write-Host ''
$secure = Read-Host 'Pega el token y pulsa Enter' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($token)) { throw 'Token vacio.' }
  npx supabase login --token $token --name sacramentum
  if ($LASTEXITCODE -ne 0) { throw 'Supabase CLI no acepto el token.' }
  Write-Host ''
  Write-Host 'LOGIN GUARDADO. Verificando proyectos...' -ForegroundColor Green
  npx supabase projects list --profile sacramentum
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $token = $null
}
Write-Host ''
Write-Host 'Puedes dejar esta ventana abierta.' -ForegroundColor Green
