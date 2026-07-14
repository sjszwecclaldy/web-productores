#!/usr/bin/env pwsh
# Smoke test post-despliegue (ejecutar desde tu PC con acceso a internet)
#
# Uso:
#   .\scripts\verify-deploy.ps1 -ApiUrl "https://web-productores-api.onrender.com" -ApiKey "tu-ingest-key"
#   .\scripts\verify-deploy.ps1 -ApiUrl "..." -ApiKey "..." -FrontendUrl "https://web-productores.onrender.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [string]$FrontendUrl = ""
)

$ApiUrl = $ApiUrl.TrimEnd("/")

Write-Host "=== Verificación de despliegue ===" -ForegroundColor Cyan

# 1. Health
Write-Host "`n[1/3] GET /health ..."
try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get
    if ($health.status -eq "ok") {
        Write-Host "  OK: backend respondiendo" -ForegroundColor Green
    } else {
        Write-Host "  WARN: respuesta inesperada: $($health | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
    exit 1
}

# 2. Sync status (requiere API key)
Write-Host "`n[2/3] GET /internal/sync-status ..."
try {
    $headers = @{ "X-Api-Key" = $ApiKey }
    $sync = Invoke-RestMethod -Uri "$ApiUrl/internal/sync-status" -Headers $headers -Method Get
    Write-Host "  OK: last_collection_date = $($sync.last_collection_date)" -ForegroundColor Green
    if ($sync.last_sync) {
        Write-Host "  last_sync: $($sync.last_sync | ConvertTo-Json -Compress)"
    }
} catch {
    Write-Host "  FAIL (¿API key incorrecta o backend caído?): $_" -ForegroundColor Red
}

# 3. Frontend accesible
if ($FrontendUrl) {
    $FrontendUrl = $FrontendUrl.TrimEnd("/")
    Write-Host "`n[3/3] GET frontend /login ..."
    try {
        $resp = Invoke-WebRequest -Uri "$FrontendUrl/login" -Method Get -MaximumRedirection 0 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            Write-Host "  OK: frontend sirve /login (rewrite SPA activo)" -ForegroundColor Green
        } else {
            Write-Host "  WARN: status $($resp.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        # Invoke-WebRequest puede lanzar en redirects; 200 es lo esperado
        if ($_.Exception.Response.StatusCode -eq 200) {
            Write-Host "  OK: frontend accesible" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n[3/3] Frontend: omitido (pasá -FrontendUrl para probar rewrite SPA)" -ForegroundColor DarkGray
}

Write-Host "`n=== Fin ===" -ForegroundColor Cyan
