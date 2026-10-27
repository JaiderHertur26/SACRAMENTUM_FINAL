# SACRAMENTUM FINAL — V229 · SEGURIDAD DE FUNCIONES PRIVILEGIADAS

**Proyecto de ensayo:** Supabase `foczofcmwampjvlfbsqn`. **Prohibido considerar cualquiera de sus registros como oficial.**

## Problema comprobado
Antes de V229, **131 funciones SECURITY DEFINER** del esquema público tenían `search_path=public`; **88** de ellas eran ejecutables por el rol PostgreSQL `authenticated`. Además, los roles `authenticated` y `anon` tenían permiso TEMP en la base. Sin `pg_temp` al final del camino, PostgreSQL puede buscar antes algunos nombres de relaciones/tipos en un esquema temporal del actor. No se ha demostrado explotación; sí se confirmó una configuración innecesariamente expuesta.

## Corrección REAL
Se creó el archivo con la CLI de Supabase y se aplicó la migración **`20261027044045_secure_definer_pg_temp_last_v229.sql`** mediante la acción de migraciones de Supabase. Actualiza solo `search_path` de funciones de propietario `postgres` que usaban exactamente `search_path=public`:

`SET search_path TO public, pg_temp`

El ajuste es idempotente, preserva el código y los permisos de cada función y **no cambia filas ni usuarios**. Una transacción previa de ensayo (con `ROLLBACK`) confirmó 131 cambios posibles. La inspección tras la migración confirmó **0** funciones con la configuración antigua y **131** con `pg_temp` último, incluidas **88** llamadas desde `authenticated`. Otras 76 funciones privilegiadas tienen caminos distintos (por ejemplo, vacío) y **no se han certificado semánticamente**.

## Regresiones ejecutadas sobre la base REAL
- **14/14** circuitos SQL reversibles que incluyen: cuatro sacramentos y asientos, decretos nuevos e históricos, notas marginales, conciliación histórica, folios, recuperación de recibos, impresión y notificaciones.
- **8/8** inicios de sesión auténticos con GoTrue tras el ajuste.
- **24/24** denegaciones por rol/parroquia ajenos para los cuatro sacramentos, además de la negativa administrativa existente en el ensayo jurisdiccional.
- **13/13** cifras de QA intactas después: partidas, pendientes, notas, decretos, constancias, auditoría y 12 cuentas. Solo datos ficticios.
- El control V229 de publicación incluye `insecure_public_only_definers`: exige **cero** y rechaza cualquier acta de seguridad sin esa cifra. La versión V226 del informe ya no habilita `official`.

## Archivos
- `AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json`: informe numérico saneado, sin nombres ni secretos.
- `scripts/release-security-preflight-v229.sql`: consulta de metadatos de solo lectura con el nuevo indicador de seguridad.
- `scripts/seal-definer-path-audit-v229.mjs`: consolida resultados QA en evidencia sin contraseñas y elimina lotes de trabajo.
- `scripts/test-secure-definer-path-v229.mjs`: evita certificados obsoletos, verifica huellas y comprueba rechazos ante desconfiguraciones; integrado en GitHub CI.
- `supabase/migrations/20261027044045_secure_definer_pg_temp_last_v229.sql`: migración aplicada a QA y versionada.

## Limitaciones y próximos bloqueos
**No** es una revisión de seguridad exhaustiva de las 152 RPC privilegiadas expuestas a autenticados. Sigue abierta la auditoría firma por firma y sus pruebas de identidad adversarial. Las ACL predeterminadas de `supabase_admin` siguen concediendo permisos futuros; solo un administrador legítimamente facultado podrá evaluar/corregirlas. Falta además verificar la entrega SMTP, restauración de copias, validez documental física y despliegue de **un proyecto nuevo SIN datos QA**.

Ninguna información ficticia fue limpiada, oficializada ni trasladada.
