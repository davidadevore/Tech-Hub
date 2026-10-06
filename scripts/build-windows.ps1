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
New-Item "$resources/drivers/power" -ItemType Directory -Force | Out-Null
Checked { go -C services/power build -trimpath -o "$resources/drivers/power/power-server.exe" . }
Checked { python -m PyInstaller --noconfirm --clean --onedir --name dsan-server --distpath build/windows-python-dist --workpath build/windows-python-work --specpath build --add-data "$projectDir/services/dsan/index.html;." services/dsan/app.py }
Copy-Item build/windows-python-dist/dsan-server "$resources/drivers/dsan" -Recurse
Copy-Item (Get-Command node).Source "$resources/node.exe"
Copy-Item hub "$resources/hub" -Recurse
Copy-Item package.json "$resources/package.json"
if (!(Test-Path dist/app-packages-universal/catalog.json)) { Checked { node scripts/build-universal.cjs } }
Checked { node scripts/bundle-services.cjs $resources --host-only }
Copy-Item dist/app-packages-universal/catalog.json "$resources/catalog.json"
$compiler = "${env:ProgramFiles(x86)}/Inno Setup 6/ISCC.exe"
if (!(Test-Path $compiler)) { throw 'Install Inno Setup 6 before building the installer.' }
Checked { & $compiler "/DAppVersion=$version" scripts/windows-installer.iss }
Copy-Item dist/app-packages-universal "$resources/offline-apps" -Recurse
Checked { & $compiler "/DAppVersion=$version" '/DOutputName=Tech-Hub-Windows-x64-Full-Setup' scripts/windows-installer.iss }
Get-ChildItem dist/Tech-Hub-Windows-x64-*.exe | ForEach-Object {
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    "$hash  $($_.Name)" | Set-Content "$($_.FullName).sha256" -Encoding ascii
}
