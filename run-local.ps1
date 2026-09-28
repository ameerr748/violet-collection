$ErrorActionPreference = "Stop"

Write-Host "Violet AI Backend - local runner" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed. Install Node.js 20+ first."
}

if (-not (Test-Path ".env.example")) {
  throw "Run this script from the violet-collection project folder."
}

$secure = Read-Host "الصق Bearer Token الجديد فقط (بدون كلمة Bearer)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ([string]::IsNullOrWhiteSpace($plain)) {
    throw "Token is empty."
  }

  $env:STORAGE_MANAGER_TOKEN = $plain
  $env:STORAGE_MANAGER_BASE_URL = "https://storagemanageriq.site"
  $env:STORAGE_MANAGER_PER_PAGE = "18"
  $env:SYNC_ON_START = "true"

  $gemini = Read-Host "الصق Gemini API Key هنا (اضغط Enter للتخطي إذا لم تجهزه بعد)" -AsSecureString
  $gPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($gemini)
  try {
    $gPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($gPtr)
    if (-not [string]::IsNullOrWhiteSpace($gPlain)) { $env:GEMINI_API_KEY = $gPlain }
  } finally {
    $gPlain = $null
    $gemini = $null
    if ($gPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($gPtr) }
  }

  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
  }

  Write-Host ""
  Write-Host "Starting Violet AI Backend..." -ForegroundColor Green
  npm start
}
finally {
  $plain = $null
  $secure = $null
  if ($ptr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  Remove-Item Env:STORAGE_MANAGER_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
}
