# SACRAMENTUM FINAL V248 — Contención efectiva de RPC de anulación documental

**27 de octubre de 2026.** Ambiente Supabase QA ficticio: `foczofcmwampjvlfbsqn`. El modo oficial permanece BLOQUEADO.

## Problema confirmado y estado previo
La V246 había demostrado mediante prueba con documento inventado y `ROLLBACK` que `public.void_document_issuance(uuid,text)` diferenciaba documento ajeno existente de inexistente. La herramienta de migraciones bloqueó modificar la definición de la función; quedó una PR en borrador #97 y no se desplegó esa corrección SQL.

La función tenía `EXECUTE` concedido a `authenticated`, sin llamadas internas desde otras funciones públicas; la tabla QA `document_issuances` tiene 0 registros.

## Contención legítima, segura y verificada
Se aplicó exitosamente mediante el canal ordinario `Supabase apply_migration` la migración `contain_document_void_exposure_v248`, versionada en `supabase/migrations/20261027170500_contain_document_void_exposure_v248.sql`.

La única operación DDL es:

```sql
REVOKE EXECUTE ON FUNCTION public.void_document_issuance(uuid,text) FROM authenticated;
```

Un `SELECT` en `pg_proc` posterior verificó que `authenticated` = false, `anon` = false, y `service_role` = true. Se intentó ejecutar la función con `SET LOCAL ROLE authenticated` y PostgreSQL respondió **SQLSTATE 42501: permission denied for function void_document_issuance**. Ningún documento fue anulado, insertado o eliminado.

Esta medida **neutraliza por el momento la exposición directa desde cuentas normales**, a costa de desactivar esa función para dichos usuarios. No modifica el cuerpo potencialmente vulnerable; por ello **no sustituye V246**, no autoriza restaurar el permiso y no demuestra el flujo completo de anulación correcto.

El catálogo `SECURITY DEFINER` ejecutable por `authenticated` quedó en **151 funciones**, frente a 152 antes de la contención. La huella MD5 calculada en la base cambió de `91f3bb1bf8a50fd85d066d86fd79da2b` a **`60019131a532a623a91c6128b9ab8daa`**. La huella está fijada en la puerta de compilación y lanzamiento; cualquier restitución del permiso o cambio de código de una RPC vuelve a fallar hasta nueva revisión.

El inventario incrementa a **166 migraciones**; se conservan **14 archivos** con **45 sentencias históricas** de modificación de datos, sin autorizar su replay en una instalación limpia. Los ensayos de CI comprueban la existencia y contenido del guard, pero la evidencia SQL real de permisos fue observada **ahora** en QA, no se reejecuta en todos los builds.

## Qué impide el 100 %
1. Aplicación segura y prueba V246 de la lógica autorizada; durante la cuarentena no puede anularse por el canal cliente habitual.
2. Una base oficial nueva, independiente y vacía de datos ficticios con restauración completa y ensayo de desastre.
3. Revisión de todas las 151 RPC expuestas, incluyendo sus efectos y autorizaciones semánticas (el número menor NO equivale a aprobación).
4. SMTP, recuperación de cuentas y aceptación de impresos, firmas y sellos por autoridad eclesial.

Se preservó la base ficticia y no se contrataron servicios nuevos. **Progreso técnico histórico: 97,41 %, todavía no certificación oficial.**
