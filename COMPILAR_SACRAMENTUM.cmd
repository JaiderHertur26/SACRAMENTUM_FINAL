@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo SACRAMENTUM - BUILD DE PRODUCCION
echo ==========================================

if not exist node_modules\.bin\vite.cmd (
  echo Instalando dependencias con npm ci...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci fallo.
    pause
    exit /b 1
  )
)

call npm run build
if errorlevel 1 (
  echo ERROR: el build fallo.
  pause
  exit /b 1
)

echo.
echo OK: build generado en dist\
pause
