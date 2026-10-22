# SACRAMENTUM V108 · Acta de producción y evidencia de seguimiento jurídico

**Fecha:** 21 de octubre de 2026 (Colombia). **Versión:** V108. **Commit de implementación:** `bc0de6d`, `main`, sincronizado con remoto.

## Publicación comprobada

- Vercel en estado **Ready**: https://sacramentum-final-gtn7pz7de-jaiderherreras-projects.vercel.app
- Alias productivo: https://sacramentum-final.vercel.app
- HTTP 200 en `/`, `/chancery/decretos/archivo?type=tribunal&sacrament=matrimonio`, `/diocese/decretos/archivo` y `/parroquia/decretos/archivo?type=tribunal&sacrament=matrimonio`.
- CSS `/assets/index-DVDdktXC.css`: **111.724 bytes**, SHA-256 `874FBBEE50499B2382CC29D8A2DEDB2AD9F4BF88F11AC452DC701E5DDA9C119C`. Cambió respecto a V107 como se esperaba al añadir controles. HTTP 200 no demuestra la ejecución de sesiones autenticadas ni revisión visual de todas las pantallas.

## Cambios y garantías

Migración aplicada en Supabase: `track_nullity_court_correspondence_v108`.
Nueva tabla `nullity_judicial_review_events` y RPC `record_nullity_judicial_review_step_v108` para seguimiento de una revisión de nulidad **sin revocación**:
- Solo Cancillería del territorio puede registrar inicio de estudio y comunicaciones documentales.
- Los eventos conservan documento, fecha, detalle, actor y referencia a solicitud, sentencia y parroquia.
- Se rechazan estado fuera de orden, duplicados, falta de sustento y fechas futuras.
- Diócesis, Cancillería y Parroquia propietaria consultan con RLS. Admin General y anon no tienen lectura de eventos.
- Sin DML directo de usuarios autenticados sobre bitácora. Los originales no se actualizan.
- Documentación de actos recibidos **no verifica por sí misma autenticidad de una decisión judicial ni ejecuta sus efectos**.

La pantalla de Cancillería permite iniciar estudio, añadir comunicaciones y ver historial. Diócesis y Parroquia distinguen petición pendiente y estudio iniciado; no editan.

## Evidencias directas del motor PostgreSQL

Dos ciclos de pruebas en transacciones ficticias, finalizados con `ROLLBACK`:
- 3 denegaciones de escritura para Administrador General, Diócesis y Parroquia.
- Cancillería creó 2 eventos posteriores, cambió expediente a `under_legal_review`, conservó Matrimonio `nullified` y sentencia `active`, 0 notas marginales nuevas.
- Comunicación antes de iniciar expediente, referencia repetida y fecha futura fueron rechazadas.
- RLS: Admin General 0; Diócesis 1, Cancillería 1 y Parroquia titular 1.
- Comprobación posterior: **0 expedientes**, **0 eventos**, **0 decretos** y **0 matrimonios** QA-V108, **0 auditorías de estas actuaciones** persistidos.
- No se hizo prueba de dos parroquias autenticadas distintas porque solo hay un usuario parroquial activo; ese control queda pendiente.

## Regresión, CI y plan maestro

- **381/381 pruebas sintéticas** superadas, incluidas **20** nuevas V108.
- **23 verificadores históricos** correctos; build Vite exitoso.
- Puerta de calidad **25/26**, único bloqueo dependencias externas (5 HIGH).
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39706944283 — `pruebas-funcionales: SUCCESS`, `seguridad-dependencias: FAILURE` por el umbral mantenido.
- Auditoría maestra de **325 controles distintos**: 9 APROBADO, 70 EN_PROGRESO, 245 PENDIENTE, 1 FALLIDO.

## Avisos Supabase

- 128 advertencias `authenticated_security_definer_function_executable`: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- 62 advertencias `pg_graphql_authenticated_table_exposed`: https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- 1 aviso `auth_leaked_password_protection`: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

No son cantidades equivalentes a vulnerabilidades explotables; requieren evaluación individual.

## Sigue abierto

La decisión judicial definitiva, su autenticación y cualquier eventual comunicación rectificativa con efectos sobre partidas y notas todavía necesitan diseño legal y validación institucional. También falta la inspección real de todas las pantallas con sesiones autenticadas, pruebas de concurrencia interparroquial, restauración completa de backup en laboratorio, resolución segura de cinco HIGH y continuación de auditoría de funciones privilegiadas.

**Informe detallado:** `AUDITORIA_ACTUACIONES_NULIDAD_V108_2026-10-21.md`.
