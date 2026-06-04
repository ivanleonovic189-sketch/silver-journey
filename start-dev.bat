@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" call npm install
if not exist "frontend\node_modules\" (
  cd frontend
  call npm install
  cd ..
)

echo.
echo ========================================
echo   Enter Pay - starting...
echo   Site: http://localhost:5179
echo   API:  http://localhost:3002
echo ========================================
echo.

REM Stop old copies (fixes 5180/5184 and EADDRINUSE)
for %%P in (3002 5179 5180 5181 5182 5183 5184 5185) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo Open in browser: http://localhost:5179
echo Press Ctrl+C to stop.
echo.

npm run dev
pause