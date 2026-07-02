# Agrega DNS de Resend en Vercel + verifica dominio + actualiza remitente en Supabase.
# Requiere: npx vercel login (una vez) y RESEND_API_KEY en env o como argumento.
param(
  [string]$ResendApiKey = $env:RESEND_API_KEY
)

$ErrorActionPreference = 'Stop'
$Domain = 'fitengine.app'
$DomainId = '80e5491a-7215-4fda-ab70-7ad234327f83'
$ProjectRef = 'nfjjkvjsssgxxsuocmhj'

if (-not $ResendApiKey) {
  Write-Host 'Falta RESEND_API_KEY' -ForegroundColor Red
  exit 1
}

Write-Host 'Comprobando login de Vercel...'
$whoami = npx vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host 'No hay sesion en Vercel. Ejecuta: npx vercel login' -ForegroundColor Yellow
  exit 1
}
Write-Host "Vercel: $whoami"

Write-Host 'Leyendo registros DNS desde Resend...'
$headers = @{ Authorization = "Bearer $ResendApiKey" }
$domain = Invoke-RestMethod -Uri "https://api.resend.com/domains/$DomainId" -Headers $headers
$records = $domain.records

foreach ($r in $records) {
  $name = $r.name
  $type = $r.type
  $value = $r.value
  Write-Host "Agregando $type $name ..."
  if ($type -eq 'MX') {
    $token = (Get-Content "$env:APPDATA\com.vercel.cli\Data\auth.json" | ConvertFrom-Json).token
    $body = @{ name = $name; type = 'MX'; value = $value; mxPriority = [int]$r.priority } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "https://api.vercel.com/v2/domains/$Domain/records?teamId=team_x6cAgoUHD8fD5Am9LhKmDdDd" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body | Out-Null
  } else {
    npx vercel dns add $Domain $name $type $value
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Aviso: puede que el registro ya exista (continuando)" -ForegroundColor Yellow
  }
}

Write-Host 'Esperando 30s para propagacion DNS...'
Start-Sleep -Seconds 30

Write-Host 'Pidiendo verificacion a Resend...'
try {
  Invoke-RestMethod -Method POST -Uri "https://api.resend.com/domains/$DomainId/verify" -Headers $headers | Out-Null
} catch {
  Write-Host 'Verify aun pendiente (normal si DNS tarda mas)' -ForegroundColor Yellow
}

$status = (Invoke-RestMethod -Uri "https://api.resend.com/domains/$DomainId" -Headers $headers).status
Write-Host "Estado dominio Resend: $status"

if ($status -eq 'verified') {
  Write-Host 'Actualizando FITENGINE_EMAIL_FROM en Supabase...'
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  npx supabase secrets set 'FITENGINE_EMAIL_FROM=FitEngine <noreply@fitengine.app>' --project-ref $ProjectRef
  Write-Host 'Listo: mails desde noreply@fitengine.app' -ForegroundColor Green
} else {
  Write-Host 'DNS agregado. En 10-30 min Resend deberia marcar Verified; volve a correr este script o refresca en resend.com/domains' -ForegroundColor Cyan
}
