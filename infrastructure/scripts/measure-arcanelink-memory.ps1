param(
    [ValidateRange(10, 3600)]
    [int]$DurationSeconds = 120,

    [ValidateRange(1, 60)]
    [int]$SampleIntervalSeconds = 5,

    [ValidateRange(0, 300)]
    [int]$WarmupSeconds = 30,

    [switch]$BackendOnly,
    [switch]$ClientOnly,
    [switch]$KeepRunning,

    [string]$OutputDirectory = "artifacts\memory-load",
    [string]$BackendUrl = "http://localhost:5207/health/live",
    [int]$ClientPort = 5173,
    [string]$ClientUrl = ""
)

$ErrorActionPreference = "Stop"

if ($BackendOnly -and $ClientOnly) {
    throw "Use either -BackendOnly or -ClientOnly, not both."
}

if (-not $ClientUrl) {
    $ClientUrl = "http://127.0.0.1:$ClientPort"
}

function Invoke-MemoryMeasurement {
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendProject = Join-Path $repoRoot "backend\ArcaneLink\ArcaneLink.csproj"
$clientRoot = Join-Path $repoRoot "frontend\client.web"
$outputRoot = Join-Path $repoRoot $OutputDirectory
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runRoot = Join-Path $outputRoot $timestamp
$samplePath = Join-Path $runRoot "samples.csv"
$summaryPath = Join-Path $runRoot "summary.json"
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

$candidateProcessNames = @("dotnet", "node", "npm", "cmd")
$baselineProcessIds = Get-CandidateProcessIds
$launchedProcesses = @()
$measurementWarnings = @()

try {
    if (-not $ClientOnly) {
        $backendProcess = Start-HiddenProcess `
            -FilePath "dotnet" `
            -Arguments @("run", "--project", $backendProject, "--no-launch-profile", "--urls", "http://localhost:5207") `
            -WorkingDirectory $repoRoot

        $launchedProcesses += [pscustomobject]@{
            Role = "backend"
            Process = $backendProcess
        }
    }

    if (-not $BackendOnly) {
        $clientProcess = Start-HiddenProcess `
            -FilePath "cmd.exe" `
            -Arguments @("/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", $ClientPort.ToString()) `
            -WorkingDirectory $clientRoot

        $launchedProcesses += [pscustomobject]@{
            Role = "client"
            Process = $clientProcess
        }
    }

    $backendResponded = Wait-ForWarmup -Url $BackendUrl -Enabled:(-not $ClientOnly)
    $clientResponded = Wait-ForWarmup -Url $ClientUrl -Enabled:(-not $BackendOnly)

    if ((-not $ClientOnly) -and (-not $backendResponded)) {
        $measurementWarnings += "Backend warm-up endpoint did not respond: $BackendUrl"
    }

    if ((-not $BackendOnly) -and (-not $clientResponded)) {
        $measurementWarnings += "Client warm-up endpoint did not respond: $ClientUrl"
    }

    if ($WarmupSeconds -gt 0) {
        Start-Sleep -Seconds $WarmupSeconds
    }

    $targetProcessIds = Get-TargetProcessIds
    if ($targetProcessIds.Count -eq 0) {
        throw "No ArcaneLink-related processes were found after startup."
    }

    "timestamp,role,pid,processName,workingSetMb,privateMemoryMb,pagedMemoryMb,cpuSeconds" |
        Set-Content -LiteralPath $samplePath -Encoding utf8

    $sampleRows = @()
    $startedAt = Get-Date
    $deadline = $startedAt.AddSeconds($DurationSeconds)

    while ((Get-Date) -lt $deadline) {
        $sampleRows += Write-MemorySample -ProcessIds $targetProcessIds -SamplePath $samplePath
        Start-Sleep -Seconds $SampleIntervalSeconds
    }

    if ($sampleRows.Count -eq 0) {
        throw "No memory samples were collected. Check whether the ArcaneLink process started successfully."
    }

    if ((-not $ClientOnly) -and -not ($sampleRows | Where-Object { $_.role -eq "backend" })) {
        $measurementWarnings += "Backend process was not sampled. This run may only contain client memory data."
    }

    if ((-not $BackendOnly) -and -not ($sampleRows | Where-Object { $_.role -eq "client" })) {
        $measurementWarnings += "Client process was not sampled. This run may only contain backend memory data."
    }

    $summary = New-MemorySummary `
        -Rows $sampleRows `
        -StartedAt $startedAt `
        -FinishedAt (Get-Date) `
        -TargetProcessIds $targetProcessIds

    $summary | ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath $summaryPath -Encoding utf8

    Write-Host "ArcaneLink memory measurement complete."
    Write-Host "Samples: $samplePath"
    Write-Host "Summary: $summaryPath"

    foreach ($warning in $measurementWarnings) {
        Write-Warning $warning
    }
}
finally {
    if (-not $KeepRunning) {
        Stop-LaunchedProcesses
    }
}
}

function Get-CandidateProcessIds {
    $processes = foreach ($name in $candidateProcessNames) {
        Get-Process -Name $name -ErrorAction SilentlyContinue
    }

    @($processes | ForEach-Object { $_.Id })
}

function Get-TargetProcessIds {
    $currentCandidateIds = Get-CandidateProcessIds
    $newCandidateIds = @($currentCandidateIds | Where-Object {
        $baselineProcessIds -notcontains $_
    })
    $launcherIds = @($launchedProcesses | ForEach-Object { $_.Process.Id })

    @($launcherIds + $newCandidateIds | Sort-Object -Unique)
}

function Wait-ForWarmup {
    param(
        [string]$Url,
        [bool]$Enabled
    )

    if (-not $Enabled) {
        return $true
    }

    $deadline = (Get-Date).AddSeconds(60)

    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    Write-Warning "Warm-up endpoint did not respond within 60 seconds: $Url"
    return $false
}

function Write-MemorySample {
    param(
        [int[]]$ProcessIds,
        [string]$SamplePath
    )

    $timestamp = (Get-Date).ToString("o")
    $rows = @()

    foreach ($processId in $ProcessIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

        if (-not $process) {
            continue
        }

        $role = Get-ProcessRole -Process $process
        $row = [pscustomobject]@{
            timestamp = $timestamp
            role = $role
            pid = $process.Id
            processName = $process.ProcessName
            workingSetMb = Convert-ToMb $process.WorkingSet64
            privateMemoryMb = Convert-ToMb $process.PrivateMemorySize64
            pagedMemoryMb = Convert-ToMb $process.PagedMemorySize64
            cpuSeconds = if ($null -ne $process.CPU) { [math]::Round($process.CPU, 2) } else { $null }
        }

        $rows += $row
        Add-Content -LiteralPath $SamplePath -Encoding utf8 -Value (
            "{0},{1},{2},{3},{4},{5},{6},{7}" -f
                $row.timestamp,
                $row.role,
                $row.pid,
                $row.processName,
                (Format-CsvNumber $row.workingSetMb),
                (Format-CsvNumber $row.privateMemoryMb),
                (Format-CsvNumber $row.pagedMemoryMb),
                (Format-CsvNumber $row.cpuSeconds)
        )
    }

    $rows
}

function Get-ProcessRole {
    param([System.Diagnostics.Process]$Process)

    $launcher = $launchedProcesses | Where-Object {
        $_.Process.Id -eq $Process.Id
    } | Select-Object -First 1

    if ($launcher) {
        return "$($launcher.Role)-launcher"
    }

    if ($Process.ProcessName -eq "dotnet") {
        return "backend"
    }

    if ($Process.ProcessName -in @("node", "npm", "cmd")) {
        return "client"
    }

    return "unknown"
}

function New-MemorySummary {
    param(
        [object[]]$Rows,
        [datetime]$StartedAt,
        [datetime]$FinishedAt,
        [int[]]$TargetProcessIds
    )

    $byRole = @{}

    foreach ($roleGroup in ($Rows | Group-Object role)) {
        $roleRows = @($roleGroup.Group)
        $byRole[$roleGroup.Name] = @{
            peakWorkingSetMb = Max-Number $roleRows "workingSetMb"
            peakPrivateMemoryMb = Max-Number $roleRows "privateMemoryMb"
            lastWorkingSetMb = Sum-LatestByPid $roleRows "workingSetMb"
            lastPrivateMemoryMb = Sum-LatestByPid $roleRows "privateMemoryMb"
        }
    }

    [pscustomobject]@{
        scenario = "ArcaneLink process memory load"
        startedAt = $StartedAt.ToString("o")
        finishedAt = $FinishedAt.ToString("o")
        durationSeconds = [math]::Round(($FinishedAt - $StartedAt).TotalSeconds, 2)
        sampleIntervalSeconds = $SampleIntervalSeconds
        warmupSeconds = $WarmupSeconds
        warnings = $measurementWarnings
        device = @{
            machineName = [Environment]::MachineName
            osVersion = [Environment]::OSVersion.VersionString
            processorCount = [Environment]::ProcessorCount
            is64BitOperatingSystem = [Environment]::Is64BitOperatingSystem
            totalPhysicalMemoryMb = Get-TotalPhysicalMemoryMb
        }
        targetProcessIds = $TargetProcessIds
        totals = @{
            peakWorkingSetMb = Peak-SumByTimestamp $Rows "workingSetMb"
            peakPrivateMemoryMb = Peak-SumByTimestamp $Rows "privateMemoryMb"
            lastWorkingSetMb = Sum-LatestByPid $Rows "workingSetMb"
            lastPrivateMemoryMb = Sum-LatestByPid $Rows "privateMemoryMb"
        }
        byRole = $byRole
        files = @{
            samplesCsv = $samplePath
        }
    }
}

function Start-HiddenProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = ($Arguments | ForEach-Object { Format-ProcessArgument $_ }) -join " "
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $null = $process.Start()

    $process
}

function Format-ProcessArgument {
    param([string]$Argument)

    if ($Argument -notmatch '[\s"]') {
        return $Argument
    }

    '"' + ($Argument -replace '"', '\"') + '"'
}

function Sum-LatestByPid {
    param(
        [object[]]$Rows,
        [string]$PropertyName
    )

    $sum = 0
    foreach ($pidGroup in ($Rows | Group-Object pid)) {
        $latest = $pidGroup.Group | Sort-Object timestamp | Select-Object -Last 1
        $sum += [double]$latest.$PropertyName
    }

    [math]::Round($sum, 2)
}

function Peak-SumByTimestamp {
    param(
        [object[]]$Rows,
        [string]$PropertyName
    )

    if (-not $Rows -or $Rows.Count -eq 0) {
        return 0
    }

    $peak = 0
    foreach ($timestampGroup in ($Rows | Group-Object timestamp)) {
        $sum = 0
        foreach ($row in $timestampGroup.Group) {
            $sum += [double]$row.$PropertyName
        }

        if ($sum -gt $peak) {
            $peak = $sum
        }
    }

    [math]::Round($peak, 2)
}

function Max-Number {
    param(
        [object[]]$Rows,
        [string]$PropertyName
    )

    if (-not $Rows -or $Rows.Count -eq 0) {
        return 0
    }

    [math]::Round((($Rows | Measure-Object -Property $PropertyName -Maximum).Maximum), 2)
}

function Convert-ToMb {
    param([long]$Bytes)

    [math]::Round($Bytes / 1MB, 2)
}

function Format-CsvNumber {
    param($Value)

    if ($null -eq $Value) {
        return ""
    }

    ([double]$Value).ToString("0.##", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-TotalPhysicalMemoryMb {
    try {
        $computerInfo = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
        return [math]::Round($computerInfo.TotalPhysicalMemory / 1MB)
    }
    catch {
        return $null
    }
}

function Stop-LaunchedProcesses {
    $targetProcessIds = Get-TargetProcessIds

    foreach ($processId in ($targetProcessIds | Sort-Object -Unique -Descending)) {
        if (-not (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
            continue
        }

        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
        }
        catch {
            if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
                Write-Warning "Could not stop process ${processId}: $($_.Exception.Message)"
            }
        }
    }
}

Invoke-MemoryMeasurement
