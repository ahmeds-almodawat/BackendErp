@echo off
setlocal
cd /d "%~dp0"
echo Starting Restaurant ERP v301 Supabase Cutover Foundation...
if not exist node_modules (
  echo Installing dependencies. This needs internet the first time only...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Opening local development server...
call npm run dev
pause
