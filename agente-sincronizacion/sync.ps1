# Agente de sincronizacion SAP Business One -> Backend Render (multi-dominio)
# Compatible con Windows PowerShell 5.1 (sin instalaciones adicionales)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir 'sync.log'
$EnvFile = Join-Path $ScriptDir '.env'

. (Join-Path $ScriptDir 'sap-common.ps1')

# --- Definicion de dominios a sincronizar ------------------------------------
$Domains = @(
    @{
        Name        = 'CALIDAD_COMPOSICION'
        DomainKey   = 'calidad_composicion'
        SapService  = 'CALIDAD_COMPOSICION'
        DateField   = 'U_CollectionDate'
        IngestPath  = '/internal/ingest/calidad-composicion'
        SelectFields = @(
            'CardCode', 'CardName', 'U_CollectionDate', 'U_JobName', 'U_JobType',
            'U_Product', 'U_Sub', 'U_Fat', 'U_Protein', 'U_Lactose', 'U_TS',
            'U_FPD', 'U_Casein', 'U_Urea', 'U_Remarks'
        )
        Transform = {
            param($Row)
            $jobName = $Row.U_JobName
            if ($null -eq $jobName) { $jobName = '' }
            @{
                card_code       = $Row.CardCode
                card_name       = $Row.CardName
                collection_date = $Row.U_CollectionDate
                job_name        = $jobName
                job_type        = $Row.U_JobType
                product         = $Row.U_Product
                sub             = $Row.U_Sub
                fat             = $Row.U_Fat
                protein         = $Row.U_Protein
                lactose         = $Row.U_Lactose
                ts              = $Row.U_TS
                fpd             = $Row.U_FPD
                casein          = $Row.U_Casein
                urea            = $Row.U_Urea
                remarks         = $Row.U_Remarks
            }
        }
    },
    @{
        Name        = 'REMISION'
        DomainKey   = 'remisiones'
        SapService  = 'REMCOMPLETO'
        DateField   = 'DocDate'
        IngestPath  = '/internal/ingest/remisiones'
        SelectFields = @(
            'DocEntry', 'LineNum', 'DocNum', 'DocDate', 'DocDueDate',
            'CardCode', 'CardName', 'ItemCode', 'Dscription',
            'Quantity', 'Price', 'LineTotal',
            'CANCELED', 'U_TEMP', 'U_ANTIB'
        )
        Transform = {
            param($Row)
            @{
                card_code    = $Row.CardCode
                card_name    = $Row.CardName
                doc_entry    = $Row.DocEntry
                line_num     = $Row.LineNum
                doc_num      = $Row.DocNum
                doc_date     = $Row.DocDate
                doc_due_date = $Row.DocDueDate
                item_code    = $Row.ItemCode
                descripcion  = $Row.Dscription
                quantity     = $Row.Quantity
                price        = $Row.Price
                line_total   = $Row.LineTotal
                temperatura  = $Row.U_TEMP
                antibiotico  = $Row.U_ANTIB
                canceled     = $Row.CANCELED
            }
        }
    },
    @{
        Name        = 'LIQUIDACION'
        DomainKey   = 'liquidaciones'
        SapService  = 'LIQUIDACION'
        DateField   = 'DocDate'
        IngestPath  = '/internal/ingest/liquidaciones'
        SelectFields = @(
            'GroupCode', 'CardCode', 'DocDate', 'NumAtCard', 'ItemCode',
            'CANTIDAD', 'TOTAL', 'IMEBA', 'INIA', 'Aftosa_USD', 'Enferm_USD'
        )
        Transform = {
            param($Row)
            @{
                card_code   = $Row.CardCode
                group_code  = $Row.GroupCode
                doc_date    = $Row.DocDate
                num_at_card = $Row.NumAtCard
                item_code   = $Row.ItemCode
                cantidad    = $Row.CANTIDAD
                total       = $Row.TOTAL
                imeba       = $Row.IMEBA
                inia        = $Row.INIA
                aftosa_usd  = $Row.Aftosa_USD
                enferm_usd  = $Row.Enferm_USD
            }
        }
    },
    @{
        Name        = 'RELIQUIDACION'
        DomainKey   = 'reliquidaciones'
        SapService  = 'RELIQUIDACION'
        DateField   = 'DocDate'
        IngestPath  = '/internal/ingest/reliquidaciones'
        SelectFields = @(
            'DocNum', 'NumAtCard', 'DocDate', 'CardCode', 'CardName',
            'Dscription', 'LineTotal', 'Total_WTAmnt', 'LineTotal_Neto'
        )
        Transform = {
            param($Row)
            @{
                card_code   = $Row.CardCode
                card_name   = $Row.CardName
                doc_num     = $Row.DocNum
                num_at_card = $Row.NumAtCard
                doc_date    = $Row.DocDate
                descripcion = $Row.Dscription
                line_total  = $Row.LineTotal
                retencion   = $Row.Total_WTAmnt
                neto        = $Row.LineTotal_Neto
            }
        }
    },
    @{
        Name        = 'CALIDAD'
        DomainKey   = 'calidad_sanitaria'
        SapService  = 'CALIDAD'
        DateField   = 'U_LabDate'
        IngestPath  = '/internal/ingest/calidad-sanitaria'
        SelectFields = @(
            'Origen', 'CardCode', 'CardName', 'U_LabDate', 'Celulas', 'Bacterias'
        )
        Transform = {
            param($Row)
            @{
                card_code = $Row.CardCode
                card_name = $Row.CardName
                lab_date  = $Row.U_LabDate
                celulas   = $Row.Celulas
                bacterias = $Row.Bacterias
                origen    = $Row.Origen
            }
        }
    },
    @{
        Name        = 'VENCIMIENTO'
        DomainKey   = 'vencimientos'
        SapService  = 'VENCIMIENTO'
        DateField   = ''
        IngestPath  = '/internal/ingest/vencimientos'
        # Solo columnas de dimension (texto/fecha). Se excluyen las medidas numericas
        # U_DICOSE y GroupCode: la vista semantica las agrega/castea a decimal y HANA
        # falla (339 invalid number) en filas con valor no numerico. Sin medidas no
        # hay agregacion. dicose/group_code quedan null hasta ajustar la vista.
        SelectFields = @(
            'CardCode', 'CardName', 'E_Mail', 'Phone1', 'U_VENC_REFRE', 'validFor'
        )
        Transform = {
            param($Row)
            @{
                card_code  = $Row.CardCode
                card_name  = $Row.CardName
                email      = $Row.E_Mail
                phone      = $Row.Phone1
                venc_refre = $Row.U_VENC_REFRE
                dicose     = $Row.U_DICOSE
                valid_for  = $Row.validFor
                group_code = $Row.GroupCode
            }
        }
    }
)

function Invoke-DomainSync {
    param([hashtable]$Config, [string]$SapBaseUrl, [hashtable]$Domain)

    $startedAt = Get-Date
    $recordsFetched = 0
    $recordsUpserted = 0
    $status = 'ok'
    $errorMessage = $null

    Write-Log "=== Inicio sincronizacion $($Domain.Name) ==="

    try {
        $fromDate = Get-SyncFromDate -Config $Config -DomainKey $Domain.DomainKey
        Write-Log "Fecha de inicio del sync ($($Domain.Name)): $fromDate"

        $records = Get-SapRecords -SapBaseUrl $SapBaseUrl -FromDate $fromDate `
            -SapService $Domain.SapService -DateField $Domain.DateField `
            -SelectFields $Domain.SelectFields -Transform $Domain.Transform
        $recordsFetched = $records.Count
        Write-Log "Total registros obtenidos de SAP ($($Domain.Name)): $recordsFetched"

        if ($recordsFetched -gt 0) {
            $pushResult = Push-ToBackend -Config $Config -Records $records -IngestPath $Domain.IngestPath
            $recordsUpserted = [int]$pushResult.inserted + [int]$pushResult.updated
            $elapsed = ((Get-Date) - $startedAt).TotalSeconds
            $elapsedFormatted = '{0:N1}' -f $elapsed
            Write-Log "=== $($Domain.Name) OK - insertados: $($pushResult.inserted), actualizados: $($pushResult.updated), tiempo: ${elapsedFormatted}s ==="
        }
        else {
            Write-Log "Nada que sincronizar para $($Domain.Name)."
        }
    }
    catch {
        $status = 'error'
        $errorMessage = $_.Exception.Message
        if ($null -ne $_.ErrorDetails -and $null -ne $_.ErrorDetails.Message -and $_.ErrorDetails.Message -ne '') {
            $errorMessage = "$errorMessage - $($_.ErrorDetails.Message)"
        }
        Write-Log "$($Domain.Name): $errorMessage" 'ERROR'
    }
    finally {
        try {
            Post-SyncLog -Config $Config -StartedAt $startedAt -RecordsFetched $recordsFetched `
                -RecordsUpserted $recordsUpserted -Status $status -ErrorMessage $errorMessage `
                -DomainKey $Domain.DomainKey
        }
        catch {
            Write-Log "No se pudo registrar sync_log ($($Domain.DomainKey)): $($_.Exception.Message)" 'ERROR'
        }
    }

    return $status
}

# -- Main ---------------------------------------------------------------------

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$config = Read-EnvFile -Path $EnvFile
$sapBaseUrl = $null
$anyError = $false

Write-Log '=== Inicio corrida agente (multi-dominio) ==='

try {
    $sapBaseUrl = Invoke-SapLogin -Config $config

    foreach ($domain in $Domains) {
        $domainStatus = Invoke-DomainSync -Config $config -SapBaseUrl $sapBaseUrl -Domain $domain
        if ($domainStatus -eq 'error') { $anyError = $true }
    }
}
catch {
    Write-Log "Error fatal (login o setup): $($_.Exception.Message)" 'ERROR'
    $anyError = $true
}
finally {
    if ($null -ne $sapBaseUrl) { Invoke-SapLogout -SapBaseUrl $sapBaseUrl }
}

Write-Log '=== Fin corrida agente ==='

if ($anyError) { exit 1 }
exit 0
