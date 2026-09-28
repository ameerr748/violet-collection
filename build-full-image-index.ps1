$ErrorActionPreference = "Stop"

Write-Host "Violet AI - full visual index builder" -ForegroundColor Cyan
Write-Host "This builds the visual index for all 4578 products."
Write-Host ""

$body = '{"limit":4578}'
$result = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/ai/image-index/build" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

Write-Host ""
Write-Host "Visual index result:" -ForegroundColor Green
$result | ConvertTo-Json -Depth 10
