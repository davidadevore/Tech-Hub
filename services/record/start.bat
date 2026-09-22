@echo off
title Record Monitor
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)

set PORT=8080
for /f "usebackq" %%p in (`node -p "require('./config.json').port||8080"`) do set PORT=%%p
echo Dashboard address: http://localhost:%PORT%
start "" /min powershell -NoProfile -Command "Start-Sleep 2; Start-Process 'http://localhost:%PORT%'"

:loop
node server.js
echo.
echo Server stopped. Restarting in 5 seconds (close this window to quit)...
timeout /t 5 /nobreak >nul
goto loop
