# Reset del dominio calidad sanitaria (células / bacterias) + opcional sync.
# Usa el .env del agente (BACKEND_URL + INGEST_API_KEY).
#
# Uso:
#   # Vaciar toda la tabla y recargar histórico
#   powershell -ExecutionPolicy Bypass -File .\reset-calidad.ps1
#
#   # Borrar solo desde una fecha (evita timeout SAP) y recargar ese tramo
#   powershell -ExecutionPolicy Bypass -File .\reset-calidad.ps1 -From 2026-01-01
#
#   # Solo reset, sin correr sync.ps1
#   powershell -ExecutionPolicy Bypass -File .\reset-calidad.ps1 -NoSync

param(
    [string]$From = '',
    [switch]$NoSync
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir '.env'
$LogFile = Join-Path $ScriptDir 'reset-calidad.log'

. (Join-Path $ScriptDir 'sap-common.ps1')

Write-Log '=== Reset calidad_sanitaria ==='

if ($From -ne '' -and $From -notmatch '^\d{4}-\d{2}-\d{2}$') {
    Write-Log "From invalido (se espera YYYY-MM-DD): $From" 'ERROR'
    exit 1
}

$config = Read-EnvFile -Path $EnvFile
$base = (Get-ConfigValue -Config $config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
$key = Get-ConfigValue -Config $config -Name 'INGEST_API_KEY' -Required $true
$headers = @{ 'X-Api-Key' = $key }

$bodyObj = @{ domain = 'calidad_sanitaria' }
if ($From -ne '') {
    $bodyObj.from = $From
    Write-Log "Scope: DELETE desde $From (parcial)"
}
else {
    Write-Log 'Scope: TRUNCATE completo'
}

$body = $bodyObj | ConvertTo-Json -Compress
Write-Log "POST $base/internal/reset-domain  $body"

try {
    $result = Invoke-RestMethod -Uri "$base/internal/reset-domain" -Method Post `
        -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 120
    Write-Log ("OK: deleted={0} table={1} scope={2}" -f $result.deleted, $result.table, $result.scope)
}
catch {
    Write-Log "Error en reset-domain: $($_.Exception.Message)" 'ERROR'
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Log $_.ErrorDetails.Message 'ERROR'
    }
    exit 1
}

if ($NoSync) {
    Write-Log 'NoSync: no se ejecuta sync.ps1. Corré el agente cuando quieras recargar.'
    Write-Log '=== Fin reset calidad ==='
    exit 0
}

Write-Log 'Ejecutando sync.ps1 para recargar CALIDAD (y demas dominios)...'
$syncScript = Join-Path $ScriptDir 'sync.ps1'
& powershell -ExecutionPolicy Bypass -File $syncScript
$syncExit = $LASTEXITCODE
Write-Log "sync.ps1 termino con exit code $syncExit"
Write-Log '=== Fin reset calidad ==='
exit $syncExit
