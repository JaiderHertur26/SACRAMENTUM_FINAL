@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL

echo ===== 1/4 VERIFICADOR ESTATICO =====
node scripts\verify-legacy-import-relational.mjs || exit /b 1

echo ===== 2/4 BUILD PRODUCCION =====
call npm run build || exit /b 1

echo ===== 3/4 POSTFLIGHT SUPABASE =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_LEGACY_BOLETAS_V3_POSTFLIGHT.sql || exit /b 1

echo ===== 4/4 SMOKE REPORTED TRUE/FALSE =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_LEGACY_BOLETAS_V3_SMOKE.sql || exit /b 1

echo ===== IMPORTACION LEGACY RELACIONAL APROBADA =====
endlocal
