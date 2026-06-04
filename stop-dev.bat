@echo off
cd /d "%~dp0"
echo Ostanovka Enter Pay...
node scripts\free-ports.js
taskkill /FI "WINDOWTITLE eq EnterPay-API*" /F 2>nul
taskkill /FI "WINDOWTITLE eq EnterPay-WEB*" /F 2>nul
echo Gotovo.
pause