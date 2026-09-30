@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto install_failed
)

echo Starting Epic Fragment...
if /i "%~1"=="--no-open" (
  call npm run dev -- --host 127.0.0.1
) else (
  call npm run dev -- --host 127.0.0.1 --open
)
if errorlevel 1 goto start_failed
exit /b 0

:missing_node
echo Node.js and npm are required. Install Node.js, then double-click this file again.
pause
exit /b 1

:install_failed
echo Dependency installation failed. Check the message above and retry.
pause
exit /b 1

:start_failed
echo The game server stopped with an error. Check the message above.
pause
exit /b 1
