# Diagnostico: ¿hay mas de un analisis CALIDAD por productor el mismo dia?
# Usa el .env y sap-common.ps1 del agente.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\check-calidad-duplicados.ps1
#   powershell -ExecutionPolicy Bypass -File .\check-calidad-duplicados.ps1 -FromDate 2025-01-01
#   powershell -ExecutionPolicy Bypass -File .\check-calidad-duplicados.ps1 -FromDate 2024-01-01 -ExportCsv .\calidad-duplicados.csv
#
# Criterio: mismo CardCode + misma U_LabDate (solo fecha) con 2+ filas en la vista CALIDAD.

param(
    [string]$FromDate = '',
    [string]$ExportCsv = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir 'check-calidad-duplicados.log'
$EnvFile = Join-Path $ScriptDir '.env'

. (Join-Path $ScriptDir 'sap-common.ps1')

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ([string]::IsNullOrWhiteSpace($FromDate)) {
    $FromDate = (Get-Date).AddYears(-2).ToString('yyyy-MM-dd')
}
if ($FromDate -notmatch '^\d{4}-\d{2}-\d{2}$') {
    Write-Log "FromDate invalido (se espera YYYY-MM-DD): $FromDate" 'ERROR'
    exit 1
}

$config = Read-EnvFile -Path $EnvFile
$sapBaseUrl = $null

Write-Log "=== Check duplicados CALIDAD (desde $FromDate) ==="

try {
    $sapBaseUrl = Invoke-SapLogin -Config $config

    $records = Get-SapRecords `
        -SapBaseUrl $sapBaseUrl `
        -FromDate $FromDate `
        -SapService 'CALIDAD' `
        -DateField 'U_LabDate' `
        -SelectFields @('Origen', 'CardCode', 'CardName', 'U_LabDate', 'Celulas', 'Bacterias') `
        -Transform {
            param($Row)
            $lab = if ($null -ne $Row.U_LabDate) { [string]$Row.U_LabDate } else { '' }
            if ($lab.Length -ge 10) { $lab = $lab.Substring(0, 10) }
            @{
                origen    = $Row.Origen
                card_code = [string]$Row.CardCode
                card_name = [string]$Row.CardName
                lab_date  = $lab
                celulas   = $Row.Celulas
                bacterias = $Row.Bacterias
            }
        }

    $total = @($records).Count
    Write-Log "Registros obtenidos: $total"

    $valid = @($records | Where-Object {
        $_.card_code -and $_.card_code.Trim() -ne '' -and $_.lab_date -match '^\d{4}-\d{2}-\d{2}$'
    })

    $groups = $valid | Group-Object -Property { "$($_.card_code)|$($_.lab_date)" }
    $dupes = @($groups | Where-Object { $_.Count -gt 1 } | Sort-Object Count -Descending)

    Write-Log "Pares productor+dia unicos: $($groups.Count)"
    Write-Log "Pares con mas de un analisis: $($dupes.Count)"

    if ($dupes.Count -eq 0) {
        Write-Log 'RESULTADO: no hay mas de un analisis por productor el mismo dia en el rango consultado.'
    }
    else {
        $extraRows = ($dupes | ForEach-Object { $_.Count - 1 } | Measure-Object -Sum).Sum
        Write-Log "RESULTADO: SI hay duplicados. Filas extra (mas alla de 1 por dia): $extraRows"
        Write-Log '--- Top 30 (productor | fecha | cantidad) ---'
        $i = 0
        foreach ($g in $dupes) {
            $i++
            if ($i -gt 30) { break }
            $sample = $g.Group[0]
            $name = $sample.card_name
            if (-not $name) { $name = $sample.card_code }
            Write-Log ("  {0} | {1} | {2} filas | {3}" -f $sample.card_code, $sample.lab_date, $g.Count, $name)
            foreach ($row in $g.Group) {
                Write-Log ("      origen={0}  celulas={1}  bacterias={2}" -f $row.origen, $row.celulas, $row.bacterias)
            }
        }
        if ($dupes.Count -gt 30) {
            Write-Log ("  ... y {0} pares mas." -f ($dupes.Count - 30))
        }
    }

    if ($ExportCsv -ne '') {
        $flat = foreach ($g in $dupes) {
            foreach ($row in $g.Group) {
                [pscustomobject]@{
                    card_code = $row.card_code
                    card_name = $row.card_name
                    lab_date  = $row.lab_date
                    origen    = $row.origen
                    celulas   = $row.celulas
                    bacterias = $row.bacterias
                    count_dia = $g.Count
                }
            }
        }
        $flat | Export-Csv -Path $ExportCsv -NoTypeInformation -Encoding UTF8
        Write-Log "CSV exportado: $ExportCsv ($($flat.Count) filas)"
    }
}
catch {
    Write-Log "Error: $($_.Exception.Message)" 'ERROR'
    exit 1
}
finally {
    if ($null -ne $sapBaseUrl) { Invoke-SapLogout -SapBaseUrl $sapBaseUrl }
}

Write-Log '=== Fin check CALIDAD ==='
exit 0
