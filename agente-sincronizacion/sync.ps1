# Agente de sincronización SAP Business One → Backend Render
# Compatible con Windows PowerShell 5.1 (sin instalaciones adicionales)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir 'sync.log'
$EnvFile = Join-Path $ScriptDir '.env'

$SelectFields = @(
    'CardCode', 'CardName', 'U_CollectionDate', 'U_JobName', 'U_JobType',
    'U_Product', 'U_Sub', 'U_Fat', 'U_Protein', 'U_Lactose', 'U_TS',
    'U_FPD', 'U_Casein', 'U_Urea', 'U_Remarks'
)
$SelectClause = ($SelectFields -join ',')

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = 'INFO'
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "$timestamp [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Log "Archivo .env no encontrado: $Path" 'ERROR'
        exit 1
    }

    $vars = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith('#')) {
            return
        }
        $eqIndex = $line.IndexOf('=')
        if ($eqIndex -lt 1) {
            return
        }
        $key = $line.Substring(0, $eqIndex).Trim()
        $value = $line.Substring($eqIndex + 1).Trim()
        $vars[$key] = $value
    }
    return $vars
}

function Get-ConfigValue {
    param(
        [hashtable]$Config,
        [string]$Name,
        [bool]$Required = $false,
        [string]$Default = ''
    )

    if ($Config.ContainsKey($Name)) {
        $value = $Config[$Name]
        if ($null -ne $value -and $value.ToString().Trim() -ne '') {
            return $value.ToString().Trim()
        }
    }

    if ($Required) {
        Write-Log "Variable de entorno requerida: $Name" 'ERROR'
        exit 1
    }

    return $Default
}

function ConvertTo-JsonArray {
    param(
        [Parameter(Mandatory = $true)]
        [array]$Items
    )

    if ($Items.Count -eq 0) {
        return '[]'
    }
    if ($Items.Count -eq 1) {
        return '[' + (ConvertTo-Json -InputObject $Items[0] -Depth 5 -Compress) + ']'
    }
    return ConvertTo-Json -InputObject $Items -Depth 5 -Compress
}

function Get-BackendHeaders {
    param([hashtable]$Config)
    return @{
        'X-Api-Key' = (Get-ConfigValue -Config $Config -Name 'INGEST_API_KEY' -Required $true)
    }
}

function Invoke-BackendJsonPost {
    param(
        [string]$Url,
        [hashtable]$Headers,
        [string]$JsonBody
    )

    $utf8 = New-Object System.Text.UTF8Encoding $false
    $bodyBytes = $utf8.GetBytes($JsonBody)
    return Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -Body $bodyBytes -ContentType 'application/json; charset=utf-8'
}

function Transform-Record {
    param($Row)

    $jobName = $Row.U_JobName
    if ($null -eq $jobName) {
        $jobName = ''
    }

    return @{
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

function Get-SyncFromDate {
    param([hashtable]$Config)

    $override = Get-ConfigValue -Config $Config -Name 'SYNC_FROM_DATE'
    if ($override -ne '') {
        return $override
    }

    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $syncStatusUrl = "$backendUrl/internal/sync-status"
    $headers = Get-BackendHeaders -Config $Config

    Write-Log 'Consultando sync-status en backend…'
    $data = Invoke-RestMethod -Uri $syncStatusUrl -Method Get -Headers $headers
    $lastDate = $data.last_collection_date

    if ($null -ne $lastDate -and "$lastDate".Trim() -ne '') {
        $overlapDays = [int](Get-ConfigValue -Config $Config -Name 'SYNC_OVERLAP_DAYS' -Default '7')
        $dt = [datetime]::ParseExact($lastDate, 'yyyy-MM-dd', $null)
        $fromDate = $dt.AddDays(-1 * $overlapDays).ToString('yyyy-MM-dd')
        Write-Log "Última fecha sincronizada: $lastDate — incremental desde $fromDate (-$overlapDays días overlap)"
        return $fromDate
    }

    Write-Log 'Sin datos previos — corrida histórica completa'
    return '2000-01-01'
}

function Get-SapRecords {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$SapSession,
        [string]$SapBaseUrl,
        [string]$FromDate
    )

    $records = New-Object System.Collections.ArrayList
    $baseUrl = $SapBaseUrl.TrimEnd('/')
    $filterValue = "U_CollectionDate ge '$FromDate'"
    $filterEncoded = [uri]::EscapeDataString($filterValue)
    $url = "$baseUrl/sml.svc/CALIDAD_COMPOSICION?`$select=$SelectClause&`$filter=$filterEncoded"
    $firstRequest = $true
    $page = 0

    while ($null -ne $url -and $url -ne '') {
        $page++
        if ($firstRequest) {
            Write-Log "SAP página $page : $url"
            $resp = Invoke-RestMethod -Uri $url -Method Get -WebSession $SapSession
            $firstRequest = $false
        }
        else {
            $displayUrl = $url
            if ($displayUrl.Length -gt 120) {
                $displayUrl = $displayUrl.Substring(0, 120)
            }
            Write-Log "SAP página $page : $displayUrl"
            $resp = Invoke-RestMethod -Uri $url -Method Get -WebSession $SapSession
        }

        $batch = @()
        if ($null -ne $resp.value) {
            $batch = @($resp.value)
        }

        foreach ($row in $batch) {
            [void]$records.Add((Transform-Record -Row $row))
        }

        Write-Log "  → $($batch.Count) registros (acumulado: $($records.Count))"

        $nextLink = $null
        if ($null -ne $resp.'@odata.nextLink') {
            $nextLink = $resp.'@odata.nextLink'
        }
        elseif ($null -ne $resp.'odata.nextLink') {
            $nextLink = $resp.'odata.nextLink'
        }

        if ($null -ne $nextLink -and "$nextLink".Trim() -ne '') {
            if ($nextLink.StartsWith('http')) {
                $url = $nextLink
            }
            else {
                $url = $baseUrl + '/' + $nextLink.TrimStart('/')
            }
        }
        else {
            $url = $null
        }
    }

    return ,@($records.ToArray())
}

function Push-ToBackend {
    param(
        [hashtable]$Config,
        [array]$Records
    )

    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $ingestUrl = "$backendUrl/internal/ingest/calidad-composicion"
    $headers = Get-BackendHeaders -Config $Config
    $batchSize = [int](Get-ConfigValue -Config $Config -Name 'BATCH_SIZE' -Default '500')

    $totalInserted = 0
    $totalUpdated = 0
    $total = $Records.Count

    for ($i = 0; $i -lt $total; $i += $batchSize) {
        $end = $i + $batchSize
        if ($end -gt $total) {
            $end = $total
        }
        $batch = @($Records[$i..($end - 1)])

        Write-Log "Enviando lote $($i + 1)–$end de $total al backend…"

        $jsonBody = ConvertTo-JsonArray -Items $batch
        $result = Invoke-BackendJsonPost -Url $ingestUrl -Headers $headers -JsonBody $jsonBody

        if ($null -ne $result.inserted) {
            $totalInserted += [int]$result.inserted
        }
        if ($null -ne $result.updated) {
            $totalUpdated += [int]$result.updated
        }
    }

    return @{
        inserted = $totalInserted
        updated  = $totalUpdated
    }
}

function Post-SyncLog {
    param(
        [hashtable]$Config,
        [datetime]$StartedAt,
        [int]$RecordsFetched,
        [int]$RecordsUpserted,
        [string]$Status,
        [string]$ErrorMessage
    )

    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $syncLogUrl = "$backendUrl/internal/sync-log"
    $headers = Get-BackendHeaders -Config $Config

    $payload = @{
        started_at        = $StartedAt.ToString('o')
        records_fetched   = $RecordsFetched
        records_upserted  = $RecordsUpserted
        status            = $Status
        error_message     = $ErrorMessage
    }

    $jsonBody = $payload | ConvertTo-Json -Depth 5 -Compress
    Invoke-BackendJsonPost -Url $syncLogUrl -Headers $headers -JsonBody $jsonBody | Out-Null
}

function Invoke-SapLogin {
    param([hashtable]$Config)

    $baseUrl = (Get-ConfigValue -Config $Config -Name 'SAP_BASE_URL' -Required $true).TrimEnd('/')
    $loginUrl = "$baseUrl/Login"
    $loginPayload = @{
        CompanyDB = (Get-ConfigValue -Config $Config -Name 'SAP_COMPANY_DB' -Required $true)
        UserName  = (Get-ConfigValue -Config $Config -Name 'SAP_USER' -Required $true)
        Password  = (Get-ConfigValue -Config $Config -Name 'SAP_PASSWORD' -Required $true)
    }

    Write-Log 'Login SAP Service Layer…'
    $session = $null
    $loginJson = $loginPayload | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginJson -ContentType 'application/json' -SessionVariable session | Out-Null
    Write-Log 'Sesión SAP OK'

    return @{
        Session = $session
        BaseUrl = $baseUrl
    }
}

function Invoke-SapLogout {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$SapSession,
        [string]$SapBaseUrl
    )

    try {
        $logoutUrl = "$($SapBaseUrl.TrimEnd('/'))/Logout"
        Invoke-RestMethod -Uri $logoutUrl -Method Post -WebSession $SapSession | Out-Null
    }
    catch {
        # best-effort
    }
}

# ── Main ─────────────────────────────────────────────────────────────────────

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$config = Read-EnvFile -Path $EnvFile

$verifySsl = (Get-ConfigValue -Config $config -Name 'SAP_VERIFY_SSL' -Default 'false').ToLower()
if ($verifySsl -ne 'true') {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
}

$startedAt = Get-Date
$sapSession = $null
$sapBaseUrl = $null
$recordsFetched = 0
$recordsUpserted = 0
$status = 'ok'
$errorMessage = $null

Write-Log '=== Inicio sincronización CALIDAD_COMPOSICION ==='

try {
    $sapLogin = Invoke-SapLogin -Config $config
    $sapSession = $sapLogin.Session
    $sapBaseUrl = $sapLogin.BaseUrl

    $fromDate = Get-SyncFromDate -Config $config
    Write-Log "Fecha de inicio del sync: $fromDate"

    $records = Get-SapRecords -SapSession $sapSession -SapBaseUrl $sapBaseUrl -FromDate $fromDate
    $recordsFetched = $records.Count
    Write-Log "Total registros obtenidos de SAP: $recordsFetched"

    if ($recordsFetched -gt 0) {
        $pushResult = Push-ToBackend -Config $config -Records $records
        $recordsUpserted = [int]$pushResult.inserted + [int]$pushResult.updated
        $elapsed = ((Get-Date) - $startedAt).TotalSeconds
        $elapsedFormatted = '{0:N1}' -f $elapsed
        Write-Log "=== Sincronización OK — insertados: $($pushResult.inserted), actualizados: $($pushResult.updated), tiempo: ${elapsedFormatted}s ==="
    }
    else {
        Write-Log 'Nada que sincronizar.'
    }
}
catch {
    $status = 'error'
    $errorMessage = $_.Exception.Message
    if ($null -ne $_.ErrorDetails -and $null -ne $_.ErrorDetails.Message -and $_.ErrorDetails.Message -ne '') {
        $errorMessage = "$errorMessage — $($_.ErrorDetails.Message)"
    }
    Write-Log $errorMessage 'ERROR'
}
finally {
    try {
        Post-SyncLog -Config $config -StartedAt $startedAt -RecordsFetched $recordsFetched `
            -RecordsUpserted $recordsUpserted -Status $status -ErrorMessage $errorMessage
    }
    catch {
        Write-Log "No se pudo registrar sync_log: $($_.Exception.Message)" 'ERROR'
    }

    if ($null -ne $sapSession -and $null -ne $sapBaseUrl) {
        Invoke-SapLogout -SapSession $sapSession -SapBaseUrl $sapBaseUrl
    }
}

if ($status -eq 'error') {
    exit 1
}

exit 0
