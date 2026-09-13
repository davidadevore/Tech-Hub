$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location $projectDir
function Checked { param([scriptblock]$Command) & $Command; if ($LASTEXITCODE -ne 0) { throw "Build command failed ($LASTEXITCODE)" } }
$version = (Get-Content package.json | ConvertFrom-Json).version
$app = Join-Path $projectDir 'dist/windows/Tech Hub'
$resources = Join-Path $app 'resources'
if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item $resources -ItemType Directory -Force | Out-Null
Checked { dotnet publish native-windows/TechHub.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true "-p:Version=$version" -o $app }
Checked { go -C services/power build -trimpath -o "$resources/power-server.exe" . }
Checked { python -m PyInstaller --noconfirm --clean --onedir --name dsan-server --distpath build/windows-python-dist --workpath build/windows-python-work --specpath build --add-data "$projectDir/services/dsan/index.html;." services/dsan/app.py }
Copy-Item build/windows-python-dist/dsan-server "$resources/dsan" -Recurse
Checked { node services/lux/node_modules/vite/bin/vite.js build --config services/lux/desktop/vite.config.ts }
New-Item "$resources/lux" -ItemType Directory -Force | Out-Null
Copy-Item services/lux/desktop-web "$resources/lux/dashboard" -Recurse
Copy-Item services/lux/electron,services/lux/lib "$resources/lux" -Recurse
Copy-Item services/lux/package.json "$resources/lux/package.json"
Copy-Item (Get-Command node).Source "$resources/node.exe"
Copy-Item hub "$resources/hub" -Recurse
Copy-Item package.json "$resources/package.json"
$compiler = "${env:ProgramFiles(x86)}/Inno Setup 6/ISCC.exe"
if (!(Test-Path $compiler)) { throw 'Install Inno Setup 6 before building the installer.' }
Checked { & $compiler "/DAppVersion=$version" scripts/windows-installer.iss }
Get-ChildItem dist/Tech-Hub-Windows-x64-Setup.exe | ForEach-Object {
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    "$hash  $($_.Name)" | Set-Content "$($_.FullName).sha256" -Encoding ascii
}
