@echo off
REM Starts the DocVerify backend and frontend in two windows.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org ^(version 20 or newer^).
  pause
  exit /b 1
)

if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist frontend\.env copy frontend\.env.example frontend\.env >nul

if not exist backend\node_modules (
  echo Installing backend dependencies...
  pushd backend
  call npm install
  popd
)
if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  pushd frontend
  call npm install
  popd
)

start "DocVerify backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "DocVerify frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Opening http://localhost:5173 in a few seconds...
timeout /t 6 >nul
start http://localhost:5173
