param(
  [string]$InputPath = "tools/svg/generated/reference_06_03_continuous_road.png",
  [string]$OutputPath = "tools/svg/generated/sharp/reference_06_03",
  [string]$EnvironmentPath = "C:\tmp\control-ai-sharp-env",
  [string]$RepositoryPath = "C:\tmp\apple-ml-sharp",
  [switch]$RenderTrajectory,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$resolvedInput = if ([System.IO.Path]::IsPathRooted($InputPath)) {
  [System.IO.Path]::GetFullPath($InputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $workspace $InputPath))
}
$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  [System.IO.Path]::GetFullPath($OutputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputPath))
}

if (-not (Test-Path -LiteralPath $resolvedInput)) {
  throw "Missing SHARP input: $resolvedInput"
}
if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda is required to create SHARP's Python 3.13 environment."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required to obtain apple/ml-sharp."
}

if (-not $SkipInstall) {
  if (-not (Test-Path -LiteralPath (Join-Path $EnvironmentPath "python.exe"))) {
    conda create --prefix $EnvironmentPath python=3.13 -y
  }
  if (-not (Test-Path -LiteralPath (Join-Path $RepositoryPath ".git"))) {
    git clone --depth 1 https://github.com/apple/ml-sharp.git $RepositoryPath
  }
  & (Join-Path $EnvironmentPath "python.exe") -m pip install -r (Join-Path $RepositoryPath "requirements.txt")
}

$sharp = Join-Path $EnvironmentPath "Scripts/sharp.exe"
if (-not (Test-Path -LiteralPath $sharp)) {
  throw "SHARP is not installed at $sharp. Run again without -SkipInstall."
}

$inputDirectory = $resolvedInput
if (-not (Get-Item -LiteralPath $resolvedInput).PSIsContainer) {
  $inputDirectory = Join-Path $resolvedOutput "input"
  New-Item -ItemType Directory -Force -Path $inputDirectory | Out-Null
  Copy-Item -LiteralPath $resolvedInput -Destination (Join-Path $inputDirectory (Split-Path $resolvedInput -Leaf)) -Force
}
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$arguments = @("predict", "-i", $inputDirectory, "-o", $resolvedOutput)
if ($RenderTrajectory) {
  $arguments += "--render"
}
& $sharp @arguments

