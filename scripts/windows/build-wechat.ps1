param(
    [Parameter(Mandatory = $true)][string]$CreatorPath,
    [Parameter(Mandatory = $true)][string]$ProjectPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($CreatorPath)) {
    throw 'COCOS_CREATOR_PATH is empty.'
}
if (-not (Test-Path -LiteralPath $CreatorPath -PathType Leaf)) {
    throw "Cocos Creator executable not found: $CreatorPath"
}
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    throw "Cocos project not found: $ProjectPath"
}

$packagePath = Join-Path $ProjectPath 'package.json'
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ($package.creator.version -ne '3.8.8') {
    throw "Expected Cocos Creator 3.8.8, found $($package.creator.version)"
}

$engineSettingsPath = Join-Path $ProjectPath 'settings\v2\packages\engine.json'
$projectSettingsPath = Join-Path $ProjectPath 'settings\v2\packages\project.json'
$scenePath = Join-Path $ProjectPath 'assets\scenes\Game.scene'
$sceneMetaPath = "$scenePath.meta"
$scriptMetaPath = Join-Path $ProjectPath 'assets\scripts\PuckBattleBootstrap.ts.meta'

foreach ($file in @($engineSettingsPath, $projectSettingsPath, $scenePath, $sceneMetaPath, $scriptMetaPath)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Required Cocos project file missing: $file"
    }
}

$engineSettings = Get-Content -LiteralPath $engineSettingsPath -Raw | ConvertFrom-Json
if ($engineSettings.modules.includeModules -notcontains 'physics-2d-box2d') {
    throw 'The project engine settings do not include physics-2d-box2d.'
}

$runnerTemp = $env:RUNNER_TEMP
if ([string]::IsNullOrWhiteSpace($runnerTemp)) { $runnerTemp = $env:TEMP }
if ([string]::IsNullOrWhiteSpace($runnerTemp)) { throw 'Neither RUNNER_TEMP nor TEMP is available.' }
New-Item -ItemType Directory -Force -Path $runnerTemp | Out-Null

$stdoutPath = Join-Path $runnerTemp 'cocos-build.stdout.log'
$stderrPath = Join-Path $runnerTemp 'cocos-build.stderr.log'
$cliLogPath = Join-Path $runnerTemp 'cocos-creator-cli.log'
$summaryPath = Join-Path $runnerTemp 'cocos-build.log'
$configPath = Join-Path $PSScriptRoot 'wechat-build-config.json'
$buildOutputRoot = Join-Path $ProjectPath 'build'
$buildPath = Join-Path $buildOutputRoot 'ci-wechatgame'

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Cocos build configuration is missing: $configPath"
}
$buildConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if ($buildConfig.platform -ne 'wechatgame') {
    throw 'The Cocos build config must target platform=wechatgame.'
}
if (-not ($buildConfig.debug -is [bool])) {
    throw 'The Cocos build config debug field must be a JSON boolean.'
}
if ($buildConfig.buildPath -ne 'project://build') {
    throw 'The Cocos build config must use buildPath=project://build.'
}
if ($buildConfig.outputName -ne 'ci-wechatgame') {
    throw 'The Cocos build config must use outputName=ci-wechatgame.'
}

$buildArgs = "configPath=$configPath;logDest=$cliLogPath"

@(
    'Word Puck Cocos Creator build diagnostics'
    ('Timestamp: ' + (Get-Date -Format o))
    ('Windows identity: ' + (& whoami))
    ('USERPROFILE: ' + $env:USERPROFILE)
    ('Creator executable: ' + $CreatorPath)
    ('Creator version expected: 3.8.8')
    ('Project root: ' + $ProjectPath)
    ('Project settings: ' + $engineSettingsPath)
    ('Build config: ' + $configPath)
    ('Build output: ' + $buildPath)
    ('Runner temp: ' + $runnerTemp)
    ('Build arguments: ' + $buildArgs)
) | Set-Content -LiteralPath $summaryPath -Encoding UTF8

try {
    $creatorProcesses = @(Get-CimInstance Win32_Process -Filter "Name='CocosCreator.exe'" |
        Select-Object ProcessId, ParentProcessId, CommandLine)
    ('Existing CocosCreator.exe process count: ' + $creatorProcesses.Count) |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
    $creatorProcesses | Format-List | Out-String |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
} catch {
    ('Could not enumerate existing Cocos Creator processes: ' + $_.Exception.Message) |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
}

if (Test-Path -LiteralPath $buildPath) {
    Remove-Item -LiteralPath $buildPath -Recurse -Force
}
foreach ($oldLog in @($stdoutPath, $stderrPath, $cliLogPath)) {
    if (Test-Path -LiteralPath $oldLog) { Remove-Item -LiteralPath $oldLog -Force }
}

Write-Host "Running as: $(& whoami)"
Write-Host "User profile: $env:USERPROFILE"
Write-Host "Cocos Creator: $CreatorPath"
Write-Host "Project: $ProjectPath"
Write-Host "Build config: $configPath"
Write-Host "Build output: $buildPath"
Write-Host "Build log: $summaryPath"

$argumentList = @(
    '--project',
    ('"' + $ProjectPath + '"'),
    '--build',
    ('"' + $buildArgs + '"')
)

try {
    $process = Start-Process -FilePath $CreatorPath -ArgumentList $argumentList -WorkingDirectory $ProjectPath -PassThru -Wait -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $exitCode = $process.ExitCode
} catch {
    ('Start-Process failed: ' + $_.Exception.ToString()) |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
    throw
}

'--- Cocos Creator stdout ---' | Add-Content -LiteralPath $summaryPath -Encoding UTF8
if (Test-Path -LiteralPath $stdoutPath) {
    Get-Content -LiteralPath $stdoutPath -Raw |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
}
'--- Cocos Creator stderr ---' | Add-Content -LiteralPath $summaryPath -Encoding UTF8
if (Test-Path -LiteralPath $stderrPath) {
    Get-Content -LiteralPath $stderrPath -Raw |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
}
'--- Cocos Creator internal log ---' | Add-Content -LiteralPath $summaryPath -Encoding UTF8
if (Test-Path -LiteralPath $cliLogPath) {
    Get-Content -LiteralPath $cliLogPath -Raw |
        Add-Content -LiteralPath $summaryPath -Encoding UTF8
}

('Cocos Creator process exit code: ' + $exitCode) |
    Add-Content -LiteralPath $summaryPath -Encoding UTF8

if ($exitCode -notin @(0, 36)) {
    throw "Cocos Creator build failed with exit code $exitCode. See $summaryPath and $cliLogPath"
}
if (-not (Test-Path -LiteralPath $buildPath -PathType Container)) {
    $fallbackPath = Join-Path $buildOutputRoot 'wechatgame'
    if (Test-Path -LiteralPath $fallbackPath -PathType Container) {
        throw "Build was generated in the fallback directory $fallbackPath. Check the committed build config and Cocos Creator CLI output."
    }
    throw "Cocos Creator exited successfully but build output is missing: $buildPath"
}

$buildFiles = @(Get-ChildItem -LiteralPath $buildPath -File -Recurse)
if ($buildFiles.Count -eq 0) {
    throw "Cocos Creator build output is empty: $buildPath"
}

('Build output file count: ' + $buildFiles.Count) |
    Add-Content -LiteralPath $summaryPath -Encoding UTF8
Write-Host "WeChat Mini Game build completed. Output files: $($buildFiles.Count)"
Write-Host "Build output: $buildPath"
