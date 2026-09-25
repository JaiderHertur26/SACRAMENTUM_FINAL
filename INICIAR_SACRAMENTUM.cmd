@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo SACRAMENTUM - INICIO LOCAL
echo ==========================================

if not exist package.json (
  echo ERROR: package.json no encontrado.
  pause
  exit /b 1
)

if not exist .env.local (
  if exist .env.example copy /Y .env.example .env.local >nul
  echo ERROR: falta configurar .env.local.
  echo Complete VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y vuelva a ejecutar.
  pause
  exit /b 1
)

if not exist node_modules\.bin\vite.cmd (
  echo Instalando dependencias con npm ci...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci fallo.
    pause
    exit /b 1
  )
)

echo Iniciando SACRAMENTUM...
call npm run dev
