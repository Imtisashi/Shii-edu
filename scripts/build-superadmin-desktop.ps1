$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$source = Join-Path $root 'desktop\SuperadminLauncher.cs'
$outDir = Join-Path $root 'dist\desktop'
$outFile = Join-Path $outDir 'Shii-Edu-Superadmin.exe'
$publicOutDir = Join-Path $root 'public\downloads\desktop'
$publicOutFile = Join-Path $publicOutDir 'Shii-Edu-Superadmin.exe'

if (!(Test-Path $source)) {
  throw "Desktop launcher source not found: $source"
}

$pathCsc = (Get-Command csc.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
$candidates = @(
  $pathCsc,
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { $_ -and (Test-Path $_) }

$csc = $candidates | Select-Object -First 1
if (!$csc) {
  throw 'No C# compiler was found. Install .NET SDK or enable .NET Framework compiler support.'
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $publicOutDir | Out-Null

& $csc `
  /nologo `
  /target:winexe `
  /platform:anycpu `
  /optimize+ `
  "/out:$outFile" `
  /reference:System.Windows.Forms.dll `
  $source

if ($LASTEXITCODE -ne 0) {
  throw "Desktop launcher build failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath $outFile -Destination $publicOutFile -Force

Write-Host "Built $outFile"
Write-Host "Published $publicOutFile"
