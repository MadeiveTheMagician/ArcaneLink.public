[CmdletBinding()]
param(
    [string]$RootDirectory = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RootDirectory)) {
    $RootDirectory = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

$root = (Resolve-Path -LiteralPath $RootDirectory).Path
$selfPath = $MyInvocation.MyCommand.Path
$privateToolDirectory = '.co' + 'dex'

function Get-RelativeFilePath {
    param(
        [Parameter(Mandatory)] [string]$BasePath,
        [Parameter(Mandatory)] [string]$FilePath
    )

    return [IO.Path]::GetRelativePath($BasePath, $FilePath)
}

function Get-ReleaseFiles {
    $gitDirectory = Join-Path $root ".git"
    $gitCommand = Get-Command git -ErrorAction SilentlyContinue

    if ($gitCommand -and (Test-Path -LiteralPath $gitDirectory)) {
        # Inspect every path that can enter a normal Git publication, including
        # new files that have not been added to the index yet. Ignored local
        # configuration remains outside this manifest by design.
        $releaseCandidates = & git -C $root ls-files --cached --others --exclude-standard
        if ($LASTEXITCODE -ne 0) {
            throw "git ls-files failed."
        }

        return @($releaseCandidates | Sort-Object -Unique | ForEach-Object {
            Join-Path $root ($_ -replace '/', [IO.Path]::DirectorySeparatorChar)
        })
    }

    return @(Get-ChildItem -LiteralPath $root -Recurse -Force -File |
        Where-Object {
            $relative = (Get-RelativeFilePath -BasePath $root -FilePath $_.FullName) -replace '\\', '/'
            $relative -notmatch '(^|/)(\.git|node_modules|bin|obj|dist|release|build)(/|$)'
        } |
        Select-Object -ExpandProperty FullName)
}

function Get-PhysicalForbiddenDirectories {
    $forbiddenNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    @(
        '.agents', $privateToolDirectory, '.dotnet', '.dotnet-home', '.gradle', '.presentation-work',
        '.tmp', '.vs', 'artifacts', 'backups', 'bin', 'blob-report', 'build', 'dist',
        'node_modules', 'obj', 'outputs', 'playwright-report', 'release', 'test-results'
    ) | ForEach-Object { [void]$forbiddenNames.Add($_) }

    $violations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($root)

    while ($pending.Count -gt 0) {
        $current = $pending.Pop()
        foreach ($directory in Get-ChildItem -LiteralPath $current -Force -Directory -ErrorAction Stop) {
            if ($directory.Name -eq '.git' -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                continue
            }

            $relative = (Get-RelativeFilePath -BasePath $root -FilePath $directory.FullName) -replace '\\', '/'
            $isGeneratedMobileBundle = $relative -eq 'frontend/client.mobile/android/app/src/main/assets/public'
            if ($forbiddenNames.Contains($directory.Name) -or $isGeneratedMobileBundle) {
                [void]$violations.Add($relative)
                continue
            }

            $pending.Push($directory.FullName)
        }
    }

    return $violations
}

function Test-ByteFilePatterns {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [Parameter(Mandatory)] [string[]]$Patterns
    )

    $combinedPattern = '(?i)(?:' + ($Patterns -join '|') + ')'
    $buffer = New-Object byte[] (1024 * 1024)
    $carry = ""
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)

    try {
        while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $chunk = $carry + [Text.Encoding]::ASCII.GetString($buffer, 0, $read)
            if ([Text.RegularExpressions.Regex]::IsMatch($chunk, $combinedPattern)) {
                return $true
            }

            $carryLength = [Math]::Min(512, $chunk.Length)
            $carry = $chunk.Substring($chunk.Length - $carryLength, $carryLength)
        }
    }
    finally {
        $stream.Dispose()
    }

    return $false
}

$forbiddenPathPatterns = @(
    '(^|/)(?:\.agents|' + [regex]::Escape($privateToolDirectory) + '|\.presentation-work|outputs)(/|$)',
    '(^|/)(\.gradle|artifacts|backups|bin|build|dist|node_modules|obj|release)(/|$)',
    '^backend/ArcaneLink/(storage|data-protection-keys)(/|$)',
    '(^|/)(playwright-report|test-results|blob-report)(/|$)',
    '^frontend/client\.mobile/android/app/src/main/assets/public(/|$)',
    '(^|/)(handoff|chat-handoff)([^/]*)(/|$)',
    '(^|/)\.env(?:\..+)?$',
    '(^|/)(?:keystore|key)\.properties$',
    '(^|/)(?:google-services\.json|GoogleService-Info\.plist|\.npmrc|NuGet\.Config)$',
    '\.(dump|sql|sql\.gz|bak|pfx|p12|pem|key|jks|keystore|reg|torrent)$'
)

$textExtensions = @(
    '.cs', '.csproj', '.json', '.md', '.ps1', '.sh', '.ts', '.tsx',
    '.js', '.jsx', '.cjs', '.mjs', '.yml', '.yaml', '.xml', '.html',
    '.css', '.scss', '.conf', '.inc', '.template', '.txt', '.properties',
    '.gradle', '.kts'
)

$binaryMediaExtensions = @(
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.mp4', '.webm',
    '.wav', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.zip', '.apk', '.exe', '.dll'
)

$authorshipNames = @(
    ('Chat' + 'GPT'),
    ('Co' + 'dex'),
    ('Open' + 'AI'),
    ('Clau' + 'de'),
    ('Gem' + 'ini')
)

$binaryProvenancePatterns = @(
    'c2pa',
    'trainedAlgorithmicMedia',
    ('Open' + 'AI')
)

$privateMaterialPatterns = @(
    '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
)

$highConfidenceSecretPatterns = @(
    '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b',
    '\bgh[pousr]_[A-Za-z0-9]{36,}\b',
    '\bgithub_pat_[A-Za-z0-9_]{50,}\b',
    '\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    '\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b',
    '(?im)^\s*(?:POSTGRES_PASSWORD|JWT_SECRET|TURN_PASSWORD|TURN_SECRET|TURN_SHARED_SECRET|API_KEY|ACCESS_TOKEN)\s*[:=]\s*(?!replace-with|change[_-]?me|example|not-a-secret|\$\{|\$\(|<)[A-Za-z0-9_./+=:-]{16,}\s*(?:#.*)?$',
    '(?im)^\s*["''](?:SecretKey|ApiKey|AccessToken|Password)["'']\s*:\s*["''](?!replace-with|change[_-]?me|example|not-a-secret|\$\{|<)[A-Za-z0-9_./+=:-]{16,}["'']',
    '(?im)^\s*ConnectionStrings__DefaultConnection\s*[:=].*;\s*Password=(?!replace-with|change[_-]?me|example|not-a-secret|\$\{|<)[^;\s"'']{8,}'
)

$localPathPatterns = @(
    '(?<![A-Za-z0-9_])[A-Za-z]:\\[^\\\s"'']+\\',
    '/home/[A-Za-z0-9._-]+/'
)

$internalAuthorshipPatterns = @(
    '(?i)\b(?:' + (($authorshipNames | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')\b'
)

$pathViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$privateMaterialViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$localPathViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$authorshipViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$secretViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$binaryProvenanceViolations = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$physicalDirectoryViolations = Get-PhysicalForbiddenDirectories

foreach ($file in Get-ReleaseFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        continue
    }

    $relative = (Get-RelativeFilePath -BasePath $root -FilePath $file) -replace '\\', '/'
    if ($relative -notin @('.env.example', '.env.local.example', '.env.turn.example')) {
        foreach ($pattern in $forbiddenPathPatterns) {
            if ($relative -match $pattern) {
                [void]$pathViolations.Add($relative)
                break
            }
        }
    }

    $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
    if ($file -ne $selfPath -and $binaryMediaExtensions -contains $extension) {
        if (Test-ByteFilePatterns -Path $file -Patterns $binaryProvenancePatterns) {
            [void]$binaryProvenanceViolations.Add($relative)
        }
    }

    if ($file -eq $selfPath -or $textExtensions -notcontains $extension) {
        continue
    }

    if (Select-String -LiteralPath $file -Pattern $privateMaterialPatterns -Quiet -ErrorAction Stop) {
        [void]$privateMaterialViolations.Add($relative)
    }
    if (Select-String -LiteralPath $file -Pattern $localPathPatterns -Quiet -ErrorAction Stop) {
        [void]$localPathViolations.Add($relative)
    }
    if (Select-String -LiteralPath $file -Pattern $internalAuthorshipPatterns -Quiet -ErrorAction Stop) {
        [void]$authorshipViolations.Add($relative)
    }
    if (Select-String -LiteralPath $file -Pattern $highConfidenceSecretPatterns -Quiet -ErrorAction Stop) {
        [void]$secretViolations.Add($relative)
    }
}

$groups = [ordered]@{
    "Generated or private directories present in the physical tree" = $physicalDirectoryViolations
    "Forbidden paths or file types" = $pathViolations
    "Private key material" = $privateMaterialViolations
    "Machine-specific absolute paths" = $localPathViolations
    "Internal authorship/tooling markers" = $authorshipViolations
    "High-confidence secret patterns" = $secretViolations
    "Generated-media provenance markers" = $binaryProvenanceViolations
}

$hasViolations = $false
foreach ($group in $groups.GetEnumerator()) {
    if ($group.Value.Count -eq 0) {
        continue
    }

    $hasViolations = $true
    Write-Host "`n$($group.Key):"
    $group.Value | Sort-Object | ForEach-Object { Write-Host "  $_" }
}

if ($hasViolations) {
    Write-Error "Release tree hygiene check failed. Only file paths were reported."
    exit 1
}

Write-Host "Release tree hygiene check passed."
