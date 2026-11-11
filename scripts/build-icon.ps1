param(
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$PngOutput,
  [Parameter(Mandatory)][string]$IcoOutput
)

Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile($Source)
$sizes = 16, 24, 32, 48, 64, 128, 256
$frames = foreach ($size in $sizes) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  ,$stream.ToArray()
}
$sourceImage.Dispose()
Copy-Item -LiteralPath $Source -Destination $PngOutput -Force

$output = [System.IO.File]::Create($IcoOutput)
$writer = [System.IO.BinaryWriter]::new($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
$offset = 6 + 16 * $frames.Count
for ($index = 0; $index -lt $frames.Count; $index++) {
  $size = $sizes[$index]
  $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
  $writer.Write([byte]$(if ($size -eq 256) { 0 } else { $size }))
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$frames[$index].Length); $writer.Write([uint32]$offset)
  $offset += $frames[$index].Length
}
foreach ($frame in $frames) { $writer.Write($frame) }
$writer.Dispose()

Write-Host "Generated $PngOutput and $IcoOutput with $($sizes.Count) icon sizes."
