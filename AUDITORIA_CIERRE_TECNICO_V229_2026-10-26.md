# SACRAMENTUM FINAL — CIERRE V229 (26 DE OCTUBRE DE 2026)

## Avance tangible
Se ha aplicado a la base de pruebas Supabase `foczofcmwampjvlfbsqn` la migración `20261027044045_secure_definer_pg_temp_last_v229` para eliminar `search_path=public` de **131 funciones SECURITY DEFINER** de propietario `postgres`, incluidas **88** ejecutables por `authenticated`.

La nueva configuración es `search_path=public, pg_temp`. Una transacción de ensayo con `ROLLBACK` probó el ajuste antes de su aplicación. La postverificación SQL confirmó **131/131 funciones corregidas** y **cero** con la configuración anterior, sin eliminar ni cambiar partidas.

## Matriz de regresiones REALES tras el cambio
Se repitieron **14/14** ensayos SQL de los cuatro sacramentos, decretos nuevos/históricos, conciliación, recibos, notas marginales, numeración, impresión y notificaciones. Cada escenario hizo `BEGIN` / `ROLLBACK` y fue satisfactorio. Adicionalmente pasaron **8/8** autenticaciones GoTrue con cuentas ficticias y **24/24** intentos rechazados de crear borradores desde instituciones sin autorización.

Inventario de solo lectura después: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 69/233/1/1 pendientes, 2 decretos, 82 notas marginales, 8 registros de impresión, 353 entradas de auditoría y 12 usuarios de Auth. Todo coincide con el inventario antes de los cambios.

## Puerta de publicación reforzada
- El protocolo de atestación para el modo `official` se elevó de **V226 a V229**. Requiere ahora `insecure_public_only_definers=0`; informes antiguos/incompletos o un solo resultado mayor que cero quedan bloqueados.
- `scripts/release-security-preflight-v229.sql` produce el nuevo conteo junto con RLS, permisos de tablas actuales y futuras, funciones privilegiadas y FKs.
- `AUDITORIA_SEGURIDAD_RPC_LIVE_V229.json` contiene métricas y huellas, sin sujetos ni contraseñas.
- `scripts/test-secure-definer-path-v229.mjs` incluye **11 comprobaciones** sobre la fuente de la migración, la atestación, el inventario, los 14 ensayos, los datos ficticios y la denegación de lanzamiento inseguro.
- `RUNBOOK_ENDURECIMIENTO_RPC_V229.md` describe la justificación, el proceso, el método reproducible y las limitaciones.
- Se mantuvo la protección que impide usar el proyecto QA conocido como oficial.

## Trabajo que sigue pendiente
No se ha certificado la seguridad semántica completa de las **152 funciones privilegiadas** accesibles desde `authenticated`. Otras 76 SECURITY DEFINER no tenían ese camino `search_path=public` y requieren su propio examen. Tampoco se ha remediado el permiso predeterminado de `supabase_admin`, que exige intervención administrativa legítima. Faltan pruebas SMTP externas, restauración efectiva de backup, aceptación de las impresiones físicas y alta de un proyecto Supabase **independiente y vacío**.

## Prohibición de mezclar QA y datos oficiales
**Toda la información existente es ficticia y permanecerá en QA durante las pruebas.** No se copiaron ni oficializaron datos y ninguno se trasladará al entorno definitivo. El despliegue de Vercel puede estar Ready como aplicación, **pero su base sigue siendo QA y nunca implica entrada en operación registral.**

## Estimación
**Avance técnico ponderado V229: 97 %** (96,54 % redondeado). No constituye certificación de uso oficial, ni conformidad canónica ni dictamen de seguridad integral.

## Auditoría completa y compilación
**2.091/2.091 pruebas sintéticas y 30/30 controles de calidad aprobados.** La compilación de la aplicación y la inspección de dependencias pasaron. Además, una compilación configurada intencionalmente como `official` sobre el proyecto conocido de QA fue bloqueada, conforme a la política de seguridad V229.
