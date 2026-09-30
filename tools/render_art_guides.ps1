param([string]$ManifestPath)
$ErrorActionPreference = 'Stop'
$artRoot = Split-Path $PSScriptRoot -Parent
if (-not $ManifestPath) { $ManifestPath = Join-Path $artRoot 'ArtSources\ProductionBrief\art_manifest.json' }
$artManifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$guideRoot = Join-Path (Split-Path $ManifestPath -Parent) 'layout_guides'
Add-Type -AssemblyName System.Drawing
$guideFont = [System.Drawing.Font]::new('Arial', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$gridPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#334553'), 1)
$solidPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#56e39f'), 6)
$platformPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#ffc857'), 6)
$whitePen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 2)
$interactionBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#69c9ff'))
try {
    foreach ($artRoom in $artManifest.rooms) {
        foreach ($artSegment in $artRoom.segments) {
            $guideBitmap = [System.Drawing.Bitmap]::new([int]$artSegment.size[0], [int]$artSegment.size[1])
            $guideGraphics = [System.Drawing.Graphics]::FromImage($guideBitmap)
            try {
                $guideGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#18232d'))
                $guideGraphics.DrawRectangle($whitePen, 64, 64, $guideBitmap.Width - 128, $guideBitmap.Height - 128)
                foreach ($worldX in [int][Math]::Floor($artSegment.minX)..[int][Math]::Ceiling($artSegment.maxX)) {
                    $pixelX = [single](($worldX - $artSegment.minX) * 128 + 64)
                    $guideGraphics.DrawLine($gridPen, $pixelX, [single]64, $pixelX, [single]($guideBitmap.Height - 64))
                }
                foreach ($worldY in [int][Math]::Ceiling($artRoom.bottom_y)..[int][Math]::Floor($artRoom.top_y)) {
                    $pixelY = [single](($artRoom.top_y - $worldY) * 128 + 64)
                    $guideGraphics.DrawLine($gridPen, [single]64, $pixelY, [single]($guideBitmap.Width - 64), $pixelY)
                }
                foreach ($artSurface in $artManifest.surfaces.($artRoom.zone)) {
                    $leftX = [Math]::Max($artSegment.minX - 0.5, $artSurface.minX)
                    $rightX = [Math]::Min($artSegment.maxX + 0.5, $artSurface.maxX)
                    if ($leftX -ge $rightX) { continue }
                    $pixelY = [single](($artRoom.top_y - $artSurface.y) * 128 + 64)
                    $activePen = if ($artSurface.oneWay) { $platformPen } else { $solidPen }
                    $guideGraphics.DrawLine($activePen, [single](($leftX - $artSegment.minX) * 128 + 64), $pixelY, [single](($rightX - $artSegment.minX) * 128 + 64), $pixelY)
                    $guideGraphics.DrawString($artSurface.id, $guideFont, [System.Drawing.Brushes]::White, [single](($leftX - $artSegment.minX) * 128 + 70), [single]($pixelY - 28))
                }
                foreach ($artInteraction in $artManifest.interactions) {
                    if ($artInteraction.zone -ne $artRoom.zone -or $artInteraction.x -lt $artSegment.minX -or $artInteraction.x -gt $artSegment.maxX) { continue }
                    $pixelX = [single](($artInteraction.x - $artSegment.minX) * 128 + 64)
                    $pixelY = [single](($artRoom.top_y - $artInteraction.y) * 128 + 64)
                    $guideGraphics.FillEllipse($interactionBrush, $pixelX - 10, $pixelY - 10, 20, 20)
                    $guideGraphics.DrawString($artInteraction.id, $guideFont, $interactionBrush, $pixelX + 14, $pixelY - 30)
                }
                $playerX = [single]($guideBitmap.Width / 2 - 40)
                $playerY = [single](($artRoom.top_y - $artSegment.reference_character[1]) * 128 + 64 - 216)
                $guideGraphics.DrawRectangle($whitePen, $playerX, $playerY, [single]80, [single]216)
                $guideGraphics.DrawString("$($artSegment.id) | 128 px/unit | GREEN floor, GOLD one-way, BLUE interaction", $guideFont, [System.Drawing.Brushes]::White, [single]76, [single]12)
                $guideBitmap.Save((Join-Path $guideRoot "$($artSegment.id).png"), [System.Drawing.Imaging.ImageFormat]::Png)
            } finally {
                $guideGraphics.Dispose()
                $guideBitmap.Dispose()
            }
        }
    }
} finally {
    $guideFont.Dispose()
    $gridPen.Dispose()
    $solidPen.Dispose()
    $platformPen.Dispose()
    $whitePen.Dispose()
    $interactionBrush.Dispose()
}
Write-Output 'Art guide PNGs generated.'
