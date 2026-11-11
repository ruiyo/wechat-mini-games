param(
    [Parameter(Mandatory = $true)]
    [string]$CreatorPath,

    [Parameter(Mandatory = $true)]
    [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($CreatorPath)) {
    throw 'COCOS_CREATOR_PATH is empty. Set the GitHub Actions repository variable to the full path of CocosCreator.exe.'
}

if (-not (Test-Path -LiteralPath $CreatorPath -PathType Leaf)) {
    throw "Cocos Creator executable not found: $CreatorPath"
}

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    throw "Cocos project directory not found: $ProjectPath"
}

$assetsPath = Join-Path $ProjectPath 'assets'
if (-not (Test-Path -LiteralPath $assetsPath -PathType Container)) {
    throw "Cocos assets directory not found: $assetsPath"
}

$sceneFiles = @(Get-ChildItem -LiteralPath $assetsPath -Filter '*.scene' -File -Recurse)
if ($sceneFiles.Count -eq 0) {
    throw @'
No Cocos Scene asset was found.
One-time editor setup is still required: create assets/scenes/Game.scene in Cocos Creator 3.8.8,
add PuckBattleBootstrap to the Canvas node, save the scene, and commit the scene plus its .meta file.
After that initial scene setup, builds run automatically from GitHub Actions.
'@
}

$runnerTemp = $env:RUNNER_TEMP
if ([string]::IsNullOrWhiteSpace($runnerTemp)) {
    $runnerTemp = $env:TEMP
}
$logPath = Join-Path $runnerTemp 'cocos-build.log'
$buildArguments = 'platform=wechatgame;debug=true;buildPath=build/ci-wechatgame'
$expectedOutput = Join-Path $ProjectPath 'build\ci-wechatgame'

Write-Host "Cocos Creator: $CreatorPath"
Write-Host "Project: $ProjectPath"
Write-Host "Scene assets: $($sceneFiles.Count)"
Write-Host "Build arguments: $buildArguments"
Write-Host "Build log: $logPath"

Push-Location $ProjectPath
try {
    & $CreatorPath --project $ProjectPath --build $buildArguments 2>&1 |
        Tee-Object -FilePath $logPath
    $creatorExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

# Cocos Creator 3.8 documents exit code 36 as success.
if ($creatorExitCode -notin @(0, 36)) {
    throw "Cocos Creator build failed with exit code $creatorExitCode. See $logPath"
}

if (-not (Test-Path -LiteralPath $expectedOutput -PathType Container)) {
    throw "Cocos Creator returned success but the expected output directory is missing: $expectedOutput"
}

$outputFiles = @(Get-ChildItem -LiteralPath $expectedOutput -File -Recurse)
if ($outputFiles.Count -eq 0) {
    throw "Build output directory is empty: $expectedOutput"
}

Write-Host "WeChat Mini Game build completed. Output files: $($outputFiles.Count)"
Write-Host "Build output: $expectedOutput"
