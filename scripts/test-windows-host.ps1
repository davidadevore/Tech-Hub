$ErrorActionPreference = 'Stop'
$app = (Resolve-Path 'dist/windows/Tech Hub/Tech Hub.exe').Path
$testDir = Join-Path ([IO.Path]::GetTempPath()) ("tech-hub-host-" + [guid]::NewGuid())
New-Item $testDir -ItemType Directory | Out-Null
$oldData = $env:TECH_HUB_DATA_DIR
$env:TECH_HUB_DATA_DIR = $testDir
$hostProcess = $null
try {
    $hostProcess = Start-Process -FilePath $app -PassThru
    $state = $null
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($hostProcess.HasExited) { throw 'Tray host exited during startup' }
        try {
            $runtime = Get-Content (Join-Path $testDir 'runtime.json') -Raw | ConvertFrom-Json
            $state = Invoke-RestMethod "http://127.0.0.1:$($runtime.adminPort)/api/status"
            if (@($state.services | Where-Object state -eq running).Count -eq 3) { break }
        } catch { }
    }
    if (@($state.services | Where-Object state -eq running).Count -ne 3) { throw "Tray host services did not start: $($state | ConvertTo-Json -Depth 4)" }
    $hostProcess.Refresh()
    if ($hostProcess.MainWindowHandle -ne 0) { throw 'Tray-only app unexpectedly opened a main window' }
    $hubPid = $runtime.pid
    Stop-Process -Id $hostProcess.Id -Force
    $hostProcess.WaitForExit()
    Start-Sleep -Seconds 2
    if (Get-Process -Id $hubPid -ErrorAction SilentlyContinue) { throw 'Hub survived tray-host termination' }
    foreach ($port in @($state.adminPort) + @($state.services.port)) {
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
        try { $listener.Start() } finally { $listener.Stop() }
    }
    Write-Output 'PASS: tray-only host starts all services; job cleanup releases their ports.'
} finally {
    if ($hostProcess -and !$hostProcess.HasExited) { Stop-Process -Id $hostProcess.Id -Force }
    $env:TECH_HUB_DATA_DIR = $oldData
    if (Test-Path "$testDir/logs/hub.log") { Get-Content "$testDir/logs/hub.log" -Tail 20 }
}
