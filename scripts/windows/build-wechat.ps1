param(
    [Parameter(Mandatory = $true)][string]$CreatorPath,
    [Parameter(Mandatory = $true)][string]$ProjectPath
)
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($CreatorPath)) { throw 'COCOS_CREATOR_PATH is empty.' }
if (-not (Test-Path -LiteralPath $CreatorPath -PathType Leaf)) { throw "Cocos Creator executable not found: $CreatorPath" }
if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "Cocos project not found: $ProjectPath" }

$package = Get-Content -LiteralPath (Join-Path $ProjectPath 'package.json') -Raw | ConvertFrom-Json
if ($package.creator.version -ne '3.8.8') { throw "Expected Cocos Creator 3.8.8, found $($package.creator.version)" }

$repoRoot = Split-Path (Split-Path $ProjectPath -Parent) -Parent
$requiredFiles = @(
    (Join-Path $ProjectPath 'assets\scenes\Game.scene'),
    (Join-Path $ProjectPath 'assets\scenes\Game.scene.meta'),
    (Join-Path $ProjectPath 'assets\scripts\PuckBattleBootstrap.ts.meta'),
    (Join-Path $repoRoot 'settings\v2\packages\engine.json')
)
foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required project file missing: $file" }
}

$runnerTemp = $env:RUNNER_TEMP
if ([string]::IsNullOrWhiteSpace($runnerTemp)) { $runnerTemp = $env:TEMP }
$logPath = Join-Path $runnerTemp 'cocos-build.log'
$buildArgs = 'platform=wechatgame;debug=true;buildPath=build/ci-wechatgame'
$outputPath = Join-Path $ProjectPath 'build\ci-wechatgame'
if (Test-Path -LiteralPath $outputPath) { Remove-Item -LiteralPath $outputPath -Recurse -Force }

Write-Host "Using Cocos Creator: $CreatorPath"
Write-Host "Building project: $ProjectPath"
Write-Host "Build arguments: $buildArgs"
Push-Location $ProjectPath
try {
    & $CreatorPath --project $ProjectPath --build $buildArgs 2>&1 | Tee-Object -FilePath $logPath
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -notin @(0, 36)) { throw "Cocos Creator build failed with exit code $exitCode. Log: $logPath" }
if (-not (Test-Path -LiteralPath $outputPath -PathType Container)) { throw "Build output directory missing: $outputPath" }
$files = @(Get-ChildItem -LiteralPath $outputPath -File -Recurse)
if ($files.Count -eq 0) { throw "Build output directory is empty: $outputPath" }
Write-Host "WeChat build completed. Files: $($files.Count)"
