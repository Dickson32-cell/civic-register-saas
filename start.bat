@echo off
rem CivicData one-click start (Windows)
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo [CivicData] No .env found next to start.bat.
  echo [CivicData] Create it from README-RUN.md section 3 ^(never commit it^).
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [CivicData] Node.js is required. Install Node 20+ from nodejs.org first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [CivicData] Installing dependencies...
  call npm install || goto :fail
)

if not exist "node_modules\.prisma\client" (
  echo [CivicData] Generating Prisma client...
  call npx prisma generate || goto :fail
)

if not exist ".next" (
  echo [CivicData] Building production bundle ^(first run takes a few minutes^)...
  call npm run build || goto :fail
)

echo [CivicData] Serving on http://localhost:3100  ^(Ctrl+C to stop^)
set PORT=3100
call npm start
exit /b 0

:fail
echo [CivicData] A step failed - read the messages above.
pause
exit /b 1
