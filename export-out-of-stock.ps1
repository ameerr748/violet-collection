$ErrorActionPreference = "Stop"
Write-Host "تجهيز تقرير المنتجات النافدة..." -ForegroundColor Cyan
npm install
node .\export-out-of-stock.js
