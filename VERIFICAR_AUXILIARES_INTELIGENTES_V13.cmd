@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL

echo.
echo ===== 1/4 MODELO CONFIRMACION EN BUSQUEDAS AUXILIARES =====
node scripts\verify-auxiliary-intelligence-v13.mjs
if errorlevel 1 exit /b 1

echo.
echo ===== 2/4 BUILD PRODUCCION =====
call npm run build
if errorlevel 1 exit /b 1

echo.
echo ===== 3/4 POSTFLIGHT SUPABASE =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_AUXILIARY_INTELLIGENCE_V13_POSTFLIGHT.sql
if errorlevel 1 exit /b 1

echo.
echo ===== 4/4 SMOKE OBISPOS TITULARES =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_BISHOP_TENURE_V13_SMOKE.sql
if errorlevel 1 exit /b 1

echo.
echo ===== AUXILIARES INTELIGENTES V13 APROBADO =====
exit /b 0
