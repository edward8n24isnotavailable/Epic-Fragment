@echo off
setlocal
cd /d "%~dp0"
if exist "release\EpicFragment.exe" (
    start "" "release\EpicFragment.exe"
    exit /b 0
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\godot.ps1" -Mode Play
if errorlevel 1 pause
