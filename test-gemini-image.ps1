$ErrorActionPreference = "Stop"

Write-Host "Violet AI - Gemini image test" -ForegroundColor Cyan

$imageUrl = "https://storagemanageriq.site/storage/products/images/prod_520Q_r1607_98843f60-847d-45b7-bc30-ff42813a734f.jpg"
$tempFile = Join-Path $env:TEMP "violet_520Q_test.jpg"

try {
  Write-Host "Downloading test image..."
  Invoke-WebRequest -Uri $imageUrl -OutFile $tempFile -UseBasicParsing

  $bytes = [System.IO.File]::ReadAllBytes($tempFile)
  $base64 = [Convert]::ToBase64String($bytes)

  $payload = @{
    base64Image = $base64
    mimeType = "image/jpeg"
  } | ConvertTo-Json -Compress

  Write-Host "Sending image to local Violet AI backend..."
  $result = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/ai/analyze-image" `
    -Method POST `
    -ContentType "application/json" `
    -Body $payload

  Write-Host ""
  Write-Host "Gemini result:" -ForegroundColor Green
  $result | ConvertTo-Json -Depth 10
}
catch {
  Write-Host ""
  Write-Host "Image test failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  try {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      $reader.Close()
      Write-Host ""
      Write-Host "Backend error details:" -ForegroundColor Yellow
      Write-Host $body
    }
  } catch {
    Write-Host "Could not read backend error details."
  }
}
finally {
  if (Test-Path $tempFile) {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
  }
}
