# Modulo compartido del agente de sincronizacion SAP -> Backend.
# Infraestructura comun a todos los dominios. No contiene logica de dominio.
# Se carga via dot-source desde sync.ps1 (comparte scope: $LogFile, $Script:SapCookies).

$Script:SapCookies = [ordered]@{}

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "$timestamp [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Invoke-WithRetry {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [int]$MaxAttempts = 4,
        [int]$DelaySeconds = 5
    )
    $attempt = 0
    while ($true) {
        $attempt++
        try {
            return & $Action
        }
        catch {
            $retryable = $false
            $resp = $_.Exception.Response
            if ($null -eq $resp) {
                $retryable = $true
            }
            else {
                try {
                    $code = [int]$resp.StatusCode
                    if ($code -ge 500) { $retryable = $true }
                }
                catch { $retryable = $true }
            }
            if (-not $retryable -or $attempt -ge $MaxAttempts) { throw }
            Write-Log "Intento $attempt fallo (reintentable): $($_.Exception.Message). Reintento en $DelaySeconds s..." 'WARN'
            Start-Sleep -Seconds $DelaySeconds
        }
    }
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
        if ($line.Length -eq 0 -or $line.StartsWith('#')) { return }
        $eqIndex = $line.IndexOf('=')
        if ($eqIndex -lt 1) { return }
        $key = $line.Substring(0, $eqIndex).Trim()
        $value = $line.Substring($eqIndex + 1).Trim()
        $vars[$key] = $value
    }
    return $vars
}

function Get-ConfigValue {
    param([hashtable]$Config, [string]$Name, [bool]$Required = $false, [string]$Default = '')
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
    param([Parameter(Mandatory = $true)][array]$Items)
    if ($Items.Count -eq 0) { return '[]' }
    if ($Items.Count -eq 1) {
        return '[' + (ConvertTo-Json -InputObject $Items[0] -Depth 5 -Compress) + ']'
    }
    return ConvertTo-Json -InputObject $Items -Depth 5 -Compress
}

function Get-BackendHeaders {
    param([hashtable]$Config)
    return @{ 'X-Api-Key' = (Get-ConfigValue -Config $Config -Name 'INGEST_API_KEY' -Required $true) }
}

function Invoke-BackendJsonPost {
    param([string]$Url, [hashtable]$Headers, [string]$JsonBody)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $bodyBytes = $utf8.GetBytes($JsonBody)
    return Invoke-WithRetry { Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -Body $bodyBytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 120 }
}

function Invoke-SapRequest {
    param([string]$Method, [string]$Url, [string]$JsonBody = $null)

    $maxAttempts = 4
    $attempt = 0
    while ($true) {
        $attempt++
        $http = $null
        try {
            $http = New-Object -ComObject WinHttp.WinHttpRequest.5.1
            $http.Option(4) = 13056
            $http.SetTimeouts(10000, 10000, 10000, 30000)
            $http.Open($Method, $Url, $false)
            if ($Script:SapCookies.Count -gt 0) {
                $cookieParts = @()
                foreach ($cookieName in $Script:SapCookies.Keys) {
                    $cookieParts += ($cookieName + '=' + $Script:SapCookies[$cookieName])
                }
                $http.SetRequestHeader('Cookie', ($cookieParts -join '; '))
            }
            if ($null -ne $JsonBody -and $JsonBody -ne '') {
                $http.SetRequestHeader('Content-Type', 'application/json')
                $http.Send($JsonBody)
            }
            else {
                $http.Send()
            }
        }
        catch {
            if ($attempt -ge $maxAttempts) {
                throw New-Object System.Exception("WINHTTP connection error tras $attempt intentos: $($_.Exception.Message)")
            }
            Write-Log "SAP intento $attempt fallo (conexion): $($_.Exception.Message). Reintento en 5 s..." 'WARN'
            Start-Sleep -Seconds 5
            continue
        }

        $allHeaders = $http.GetAllResponseHeaders()
        if ($null -ne $allHeaders -and $allHeaders -ne '') {
            foreach ($headerLine in ($allHeaders -split "`r`n")) {
                if ($headerLine -imatch '^Set-Cookie:\s*(.+)$') {
                    $pair = $Matches[1].Split(';')[0].Trim()
                    $ix = $pair.IndexOf('=')
                    if ($ix -gt 0) {
                        $Script:SapCookies[$pair.Substring(0, $ix)] = $pair.Substring($ix + 1)
                    }
                }
            }
        }

        $statusCode = [int]$http.Status
        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            return $http.ResponseText
        }

        if ($statusCode -ge 500 -and $attempt -lt $maxAttempts) {
            Write-Log "SAP intento $attempt HTTP $statusCode. Reintento en 5 s..." 'WARN'
            Start-Sleep -Seconds 5
            continue
        }

        throw New-Object System.Exception("HTTP $statusCode $($http.StatusText) - $($http.ResponseText)")
    }
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
    Write-Log 'Login SAP Service Layer...'
    $loginJson = $loginPayload | ConvertTo-Json -Compress
    Invoke-SapRequest -Method 'POST' -Url $loginUrl -JsonBody $loginJson | Out-Null
    Write-Log 'Sesion SAP OK'
    return $baseUrl
}

function Invoke-SapLogout {
    param([string]$SapBaseUrl)
    try {
        Invoke-SapRequest -Method 'POST' -Url "$($SapBaseUrl.TrimEnd('/'))/Logout" | Out-Null
    }
    catch { }
}

function Get-SyncFromDate {
    param([hashtable]$Config, [string]$DomainKey)
    $override = Get-ConfigValue -Config $Config -Name 'SYNC_FROM_DATE'
    if ($override -ne '') { return $override }
    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $syncStatusUrl = "$backendUrl/internal/sync-status?domain=$DomainKey"
    $headers = Get-BackendHeaders -Config $Config
    Write-Log "Consultando sync-status ($DomainKey) en backend..."
    $data = Invoke-WithRetry { Invoke-RestMethod -Uri $syncStatusUrl -Method Get -Headers $headers -TimeoutSec 120 }
    $lastDate = $data.last_date
    if ($null -ne $lastDate -and "$lastDate".Trim() -ne '') {
        $overlapDays = [int](Get-ConfigValue -Config $Config -Name 'SYNC_OVERLAP_DAYS' -Default '7')
        $dt = [datetime]::ParseExact($lastDate, 'yyyy-MM-dd', $null)
        $fromDate = $dt.AddDays(-1 * $overlapDays).ToString('yyyy-MM-dd')
        Write-Log "Ultima fecha sincronizada ($DomainKey): $lastDate - incremental desde $fromDate (-$overlapDays dias overlap)"
        return $fromDate
    }
    Write-Log "Sin datos previos ($DomainKey) - corrida historica completa"
    return '2000-01-01'
}

function Get-SapRecords {
    param(
        [string]$SapBaseUrl,
        [string]$FromDate,
        [string]$SapService,
        [string]$DateField,
        [string[]]$SelectFields,
        [scriptblock]$Transform
    )
    $records = New-Object System.Collections.ArrayList
    $baseUrl = $SapBaseUrl.TrimEnd('/')
    $serviceRoot = "$baseUrl/sml.svc"
    $selectClause = ($SelectFields -join ',')
    $filterValue = "$DateField ge '$FromDate'"
    $filterEncoded = [uri]::EscapeDataString($filterValue)
    $url = "$serviceRoot/$SapService" + '?$select=' + $selectClause + '&$filter=' + $filterEncoded
    $firstRequest = $true
    $page = 0
    while ($null -ne $url -and $url -ne '') {
        $page++
        $displayUrl = $url
        if (-not $firstRequest -and $displayUrl.Length -gt 120) {
            $displayUrl = $displayUrl.Substring(0, 120)
        }
        $firstRequest = $false
        Write-Log "SAP $SapService pagina $page : $displayUrl"
        $responseText = Invoke-SapRequest -Method 'GET' -Url $url
        $resp = $responseText | ConvertFrom-Json
        $batch = @()
        if ($null -ne $resp.value) { $batch = @($resp.value) }
        foreach ($row in $batch) {
            [void]$records.Add((& $Transform $row))
        }
        Write-Log "  -> $($batch.Count) registros (acumulado: $($records.Count))"
        $nextLink = $null
        if ($null -ne $resp.'@odata.nextLink') { $nextLink = $resp.'@odata.nextLink' }
        elseif ($null -ne $resp.'odata.nextLink') { $nextLink = $resp.'odata.nextLink' }
        if ($null -ne $nextLink -and "$nextLink".Trim() -ne '') {
            if ($nextLink.StartsWith('http')) { $url = $nextLink }
            else { $url = $serviceRoot + '/' + $nextLink.TrimStart('/') }
        }
        else { $url = $null }
    }
    return ,@($records.ToArray())
}

function Push-ToBackend {
    param([hashtable]$Config, [array]$Records, [string]$IngestPath)
    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $ingestUrl = "$backendUrl$IngestPath"
    $headers = Get-BackendHeaders -Config $Config
    $batchSize = [int](Get-ConfigValue -Config $Config -Name 'BATCH_SIZE' -Default '500')
    $totalInserted = 0
    $totalUpdated = 0
    $total = $Records.Count
    for ($i = 0; $i -lt $total; $i += $batchSize) {
        $end = $i + $batchSize
        if ($end -gt $total) { $end = $total }
        $batch = @($Records[$i..($end - 1)])
        Write-Log "Enviando lote $($i + 1)-$end de $total al backend..."
        $jsonBody = ConvertTo-JsonArray -Items $batch
        $result = Invoke-BackendJsonPost -Url $ingestUrl -Headers $headers -JsonBody $jsonBody
        if ($null -ne $result.inserted) { $totalInserted += [int]$result.inserted }
        if ($null -ne $result.updated) { $totalUpdated += [int]$result.updated }
    }
    return @{ inserted = $totalInserted; updated = $totalUpdated }
}

function Post-SyncLog {
    param(
        [hashtable]$Config,
        [datetime]$StartedAt,
        [int]$RecordsFetched,
        [int]$RecordsUpserted,
        [string]$Status,
        [string]$ErrorMessage,
        [string]$DomainKey
    )
    $backendUrl = (Get-ConfigValue -Config $Config -Name 'BACKEND_URL' -Required $true).TrimEnd('/')
    $syncLogUrl = "$backendUrl/internal/sync-log"
    $headers = Get-BackendHeaders -Config $Config
    $payload = @{
        started_at       = $StartedAt.ToString('o')
        records_fetched  = $RecordsFetched
        records_upserted = $RecordsUpserted
        status           = $Status
        error_message    = $ErrorMessage
        domain           = $DomainKey
    }
    $jsonBody = $payload | ConvertTo-Json -Depth 5 -Compress
    Invoke-BackendJsonPost -Url $syncLogUrl -Headers $headers -JsonBody $jsonBody | Out-Null
}
