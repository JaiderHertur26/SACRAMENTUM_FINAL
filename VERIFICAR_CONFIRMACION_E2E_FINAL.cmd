@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL

echo ===== CONFIRMACION: GATE TECNICO =====
call VERIFICAR_CONFIRMACION_CIERRE.cmd || exit /b 1

echo ===== CONFIRMACION: E2E REAL =====
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_CONFIRMACION_E2E_FINAL.sql || exit /b 1

echo ===== CONFIRMACION: E2E FINAL APROBADA =====
endlocal
