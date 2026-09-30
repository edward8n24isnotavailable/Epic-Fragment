param(
    [ValidateSet('Play', 'ArtValidation', 'Editor', 'Import', 'Test', 'Export')]
    [string]$Mode = 'Play',
    [string]$GodotExe = $env:GODOT_EXE
)

$ErrorActionPreference = 'Stop'
$gameProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not $GodotExe) {
    $workspaceEngine = Join-Path (Split-Path $gameProjectRoot -Parent) '.tools\godot\Godot_v4.7.2-stable_win64_console.exe'
    if (Test-Path -LiteralPath $workspaceEngine) {
        $GodotExe = $workspaceEngine
    } else {
        $engineCommand = Get-Command godot, godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($engineCommand) { $GodotExe = $engineCommand.Source }
    }
}
if (-not $GodotExe -or -not (Test-Path -LiteralPath $GodotExe)) {
    throw 'Godot 4.7.2 was not found. Install the standard engine and set GODOT_EXE to its executable path.'
}

function Invoke-GameEngine([string[]]$EngineArguments) {
    $engineOutput = & $GodotExe --path $gameProjectRoot @EngineArguments 2>&1
    $engineExitCode = $LASTEXITCODE
    $engineOutput | ForEach-Object { Write-Host $_ }
    if ($engineExitCode -ne 0 -or ($engineOutput | Select-String -Pattern 'SCRIPT ERROR:|^ERROR:')) {
        throw "Godot $Mode failed (exit $engineExitCode). See the engine output above."
    }
}

switch ($Mode) {
    'Play' { & $GodotExe --path $gameProjectRoot; exit $LASTEXITCODE }
    'ArtValidation' { & $GodotExe --path $gameProjectRoot 'res://scenes/art_validation.tscn'; exit $LASTEXITCODE }
    'Editor' { & $GodotExe --path $gameProjectRoot --editor; exit $LASTEXITCODE }
    'Import' { Invoke-GameEngine -EngineArguments @('--headless', '--editor', '--import', '--quit') }
    'Test' {
        Invoke-GameEngine -EngineArguments @('--headless', '--editor', '--import', '--quit')
        Invoke-GameEngine -EngineArguments @('--headless', '--fixed-fps', '60', '--script', 'tests/migration_test.gd')
        Invoke-GameEngine -EngineArguments @('--headless', '--fixed-fps', '60', '--script', 'tests/art_validation_test.gd')
    }
    'Export' {
        Invoke-GameEngine -EngineArguments @('--headless', '--editor', '--import', '--quit')
        $gameReleaseRoot = Join-Path $gameProjectRoot 'release'
        New-Item -ItemType Directory -Force $gameReleaseRoot | Out-Null
        Invoke-GameEngine -EngineArguments @('--headless', '--export-release', 'Windows Desktop')
        Invoke-GameEngine -EngineArguments @('--headless', '--script', 'tools/export_notices.gd', '--', $gameReleaseRoot)
    }
}
