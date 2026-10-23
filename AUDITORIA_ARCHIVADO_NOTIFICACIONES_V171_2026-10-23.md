# SACRAMENTUM · Auditoría V171 — Protección del archivado de avisos matrimoniales

Fecha: 23 de octubre de 2026. Ruta de trabajo: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Vulnerabilidad reproducida
La RPC `archive_matrimonial_notification_recipient(uuid)` (SECURITY DEFINER) sólo exigía `is_active=true` y rol parroquia, pero no comprobaba `user_profiles.status='ACTIVE'`. Por ello, un perfil ficticio `status='SUSPENDED'` / `is_active=true` consiguió cancelar un aviso ficticio propio. Se verificó directamente en PostgreSQL Supabase bajo `BEGIN/ROLLBACK` antes de aplicar el parche.

## Corrección
Migración `supabase/migrations/20261023180236_archive_notification_active_profile_v171.sql`: cambio quirúrgico en la función existente mediante `pg_get_functiondef` y comparación de anclaje exacto. Añade `upper(coalesce(up.status,'ACTIVE'))='ACTIVE'` al filtro de autoridad. Firma, permisos, otras RPC, notas y partidas sin cambios.

## Ensayos realizados
- Pre-corrección en Supabase: `scripts/qa-rollback-notification-archive-status-repro-v171.sql`, cuenta de laboratorio suspendida logró cancelar aviso ficticio (defecto comprobado).
- Parche instalado solamente dentro de transacción: `scripts/qa-rollback-notification-archive-active-profile-v171.sql` denegó cuenta SUSPENDED, mantuvo aviso pending, luego la misma cuenta ficticia pasó a ACTIVE y archivó legítimamente; segundo archivado idempotente y un único evento de auditoría.
- En ambas pruebas se creó usuario de prueba con dominio `example.invalid` y aviso ficticio, todo en una transacción `ROLLBACK`. Ningún usuario ni partida existentes fueron editados.
- 8 pruebas contractuales nuevas integradas. 1250/1250 sintéticas y 28/28 controles estrictos aprobados.
- La QA evalúa la función de BD bajo `SET LOCAL ROLE authenticated` y JWT de ficción; NO certifica sesiones completas de dos diócesis.
- Auditoría maestra sin promociones de controles: {"APROBADO":10,"EN_PROGRESO":117,"PENDIENTE":198}.

## Publicación
GitHub PR #17 aprobó sus controles de integración. La migración permanente 20261023180236_archive_notification_active_profile_v171 fue aplicada a Supabase y la prueba reversible volvió a aprobar directamente contra la RPC instalada. PostgreSQL confirma validación de status presente, EXECUTE de authenticated=true, anon=false, y cero usuarios, avisos y trazas QA-V171 residuales. La publicación del mismo commit en Vercel requiere verificar el CI final tras reconciliar el nombre de archivo.

**Dictamen V171:** vulnerabilidad de archivado por perfil suspendido reproducida y corregida en Supabase, con QA transaccional posterior satisfactoria. La certificación E2E autenticada entre diócesis y la concurrencia física PostgreSQL siguen pendientes.
