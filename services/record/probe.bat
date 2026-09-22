@echo off
title Ki Pro probe
cd /d "%~dp0"
set /p IP=Ki Pro IP address: 
node probe.js %IP%
pause
