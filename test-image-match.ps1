$ErrorActionPreference = "Stop"

Write-Host "Violet AI - visual matching test" -ForegroundColor Cyan
Write-Host "Building a small 18-product image index..."
$build = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/image-index/build" -Method POST -ContentType "application/json" -Body '{"limit":18}'
Write-Host ("Indexed {0} products." -f $build.count) -ForegroundColor Green

$imageUrl = "https://storagemanageriq.site/storage/products/images/prod_520Q_r1607_98843f60-847d-45b7-bc30-ff42813a734f.jpg"
$tempFile = Join-Path $env:TEMP "violet_match_520Q.jpg"
Invoke-WebRequest -Uri $imageUrl -OutFile $tempFile -UseBasicParsing

try {
  $bytes = [System.IO.File]::ReadAllBytes($tempFile)
  $payload = @{
    base64Image = [Convert]::ToBase64String($bytes)
    mimeType = "image/jpeg"
    topK = 5
  } | ConvertTo-Json -Compress

  $match = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/match-image" -Method POST -ContentType "application/json" -Body $payload
  Write-Host ""
  Write-Host "Top visual matches:" -ForegroundColor Green
  $match.matches | Select-Object product_code, similarity, selling_price, total_stock, category | Format-Table -AutoSize
}
finally {
  Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}
