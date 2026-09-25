@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL

echo ===== 1/3 INVARIANTES ESTATICOS =====
node scripts\verify-confirmation-closure.mjs || exit /b 1

echo ===== 2/3 BUILD PRODUCCION =====
call npm run build || exit /b 1

echo ===== 3/3 POSTFLIGHT SUPABASE =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_CONFIRMACION_CIERRE_POSTFLIGHT.sql || exit /b 1

echo ===== CONFIRMACION: GATE TECNICO COMPLETADO =====
endlocal
