@echo off
chcp 65001 >nul
title Enter Pay Launcher
cd /d "%~dp0"

echo.
echo  ============================================
echo    ENTER PAY - zapusk
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [OSHIBKA] Ustanovi Node.js: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Ustanavlivayu zavisimosti...
  call npm install
)
if not exist "frontend\node_modules\" (
  cd frontend
  call npm install
  cd ..
)

echo Osvobozhdayu porty...
node scripts\free-ports.js
timeout /t 2 /nobreak >nul

echo.
echo Zapusk BACKEND  (port 3002)...
start "EnterPay-API" /D "%~dp0" cmd /k "node backend\server.js"

timeout /t 2 /nobreak >nul

echo Zapusk FRONTEND (port 5179)...
start "EnterPay-WEB" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo  Gotovo! Cherez 5 sek otkroetsya brauzer.
echo.
echo  SAJT:  http://localhost:5179
echo  API:   http://localhost:3002
echo.
echo  NE ZAKRYVAY okna "EnterPay-API" i "EnterPay-WEB"!
echo  Ostanovka: stop-dev.bat
echo.

timeout /t 5 /nobreak >nul
start http://localhost:5179

echo Esli sajt ne otkrylsya - otkroy vruchnuyu: http://localhost:5179
pause