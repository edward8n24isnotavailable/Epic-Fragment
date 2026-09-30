@echo off
cd /d "%~dp0"
if exist "release\EpicFragment.exe" (
    start "" "release\EpicFragment.exe" -- --art-validation
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "tools\godot.ps1" -Mode ArtValidation
)
