@echo off
setlocal
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
node scripts\patch-boleta-parish-selector.mjs || exit /b 1
node scripts\verify-boleta-parish-selector.mjs || exit /b 1
call npx supabase db query --linked --file supabase\applied-history\SACRAMENTUM_LEGACY_BOLETA_PARISH_SCOPE_V4.sql || exit /b 1
call npx supabase db query --linked --file supabase\postflight\SACRAMENTUM_LEGACY_BOLETA_PARISH_SCOPE_V4_POSTFLIGHT.sql || exit /b 1
call npm run build || exit /b 1
echo BOLETA_PARISH_SCOPE_V4_OK
endlocal