$ErrorActionPreference = "Stop"
Write-Host "تقرير المنتجات النافدة - استخراج مباشر من Storage Manager" -ForegroundColor Cyan
$secure = Read-Host "الصق Bearer Token الجديد فقط" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:STORAGE_MANAGER_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  npm install
  node .\export-out-of-stock-direct.js
}
finally {
  Remove-Item Env:STORAGE_MANAGER_TOKEN -ErrorAction SilentlyContinue
  if ($ptr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}
