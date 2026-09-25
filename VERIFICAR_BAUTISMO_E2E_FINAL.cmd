@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
call VERIFICAR_BAUTISMO_CIERRE.cmd || exit /b 1
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_BAUTISMO_E2E_FINAL.sql || exit /b 1
echo ===== BAUTISMO: E2E FINAL APROBADA =====
