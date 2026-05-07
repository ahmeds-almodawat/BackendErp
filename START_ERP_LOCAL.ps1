Set-Location -Path $PSScriptRoot
Write-Host "Starting Restaurant ERP v301 Supabase Cutover Foundation..."
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies. This needs internet the first time only..."
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}
npm run dev
