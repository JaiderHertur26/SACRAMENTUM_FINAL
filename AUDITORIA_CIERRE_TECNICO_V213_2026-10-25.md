# SACRAMENTUM FINAL · Cierre V213: procedencia histórica y separación parroquial

**Fecha de trabajo:** 25 de octubre de 2026, Colombia (evidencia UTC: 26 de octubre).

## Incidencia real reproducida

Se encontró un cruce de procedencia en `private.materialize_pending_legacy_sacramental_records`, que comparte el índice único `(source_system, profile_key, source_key)` de `public.legacy_record_links`. Dos parroquias distintas podían reutilizar esa misma clave de origen. El segundo lote aparecía como duplicado y señalaba una boleta pendiente creada en la primera parroquia. La reproducción SQL se hizo íntegramente en una transacción `BEGIN/ROLLBACK` con datos ficticios, sin afectar registros preexistentes.

## Protección de base de datos versionada

`supabase/migrations/20261026040729_isolate_legacy_source_links_parish_v213.sql` mantiene la lógica original de negocio y añade al materializador de **INSBAUTI/INSCONFI**:
- Un bloqueo transaccional de la clave de origen compartida para evitar carreras entre importaciones paralelas.
- Verificación de `legacy_import_batches.parish_id` contra la parroquia propietaria antes de reutilizar un vínculo.
- Comprobación de que la partida o boleta física del vínculo existe **en esa misma parroquia**.
- Fallo seguro con aviso de procedencia incorrecta, sin reasignar ni sobrescribir el vínculo ajeno.
- Parche condicionado al esquema actual: si la función cambia, falla antes de hacer cambios.

La migración se **probó primero dentro de una transacción que terminó con ROLLBACK** y después se registró y aplicó en Supabase con la versión oficial `20261026040729`. Las pruebas reversibles posteriores a su instalación volvieron a pasar. La prueba nueva `qa-rollback-legacy-scope-guard-v213.sql` confirmó que el vínculo de otra parroquia es denegado, que el vínculo original se preserva y que un nuevo lote de la misma parroquia reutiliza el vínculo propio sin duplicarlo.

## Compatibilidad de la interfaz y servicio

`resolveLegacySourceScope` consulta el historial del archivo para la parroquia y el perfil actuales. Si el mismo archivo ya había sido importado por esa parroquia antes de V213, conserva la clave histórica para no duplicar registros. Las nuevas importaciones generan un ámbito distinto por parroquia, incluso cuando los bytes del archivo JSON son idénticos. Un fallo al consultar el historial detiene la importación antes de generar un lote, en lugar de suponer un ámbito inseguro.

## Supabase: validación real reversible

| Control | Evidencia |
|---|---|
| Reproducción de fallo anterior (boleta de otra parroquia vinculada) | Confirmada en SQL ficticio con ROLLBACK |
| Nueva protección contra procedencia de otra parroquia | Aprobada tras simulación transaccional de la migración |
| Idempotencia del reintento en su parroquia original | Aprobada |
| Boleta INSBAUTI no reportada | 1 pendiente sintético correcto |
| Boleta INSBAUTI reportada sin partida coincidente | 1 fila en revisión, ninguna partida nueva |
| Boleta INSCONFI no reportada | 1 pendiente sintético correcto |
| Boleta INSCONFI reportada sin partida coincidente | 1 fila en revisión, ninguna partida nueva |
| Vínculos históricos inspeccionados (68 Bautismo, 232 Confirmación) | 300 en total; 0 cruces detectados |
| Duplicados históricos existentes de estos lotes | 0 |
| Residuos QA213 posteriores al ROLLBACK | 0 |

## Auditoría completa

- **1.696/1.696 pruebas automatizadas aprobadas** (+16 controles específicos).
- **30/30** verificaciones estrictas aprobadas.
- Compilación de producción Vite, secretos de compilación y auditorías npm aprobados.
- El laboratorio navegador de migración histórica se mantiene operativo con servicios ficticios; no introduce escrituras reales en CI.

## Despliegue y seguimiento

La migración ya fue registrada mediante el conector autorizado de Supabase, **después de aprobar GitHub CI**; las verificaciones QA fueron transacciones reversibles, sin residuos permanentes. La CLI del equipo devolvió HTTP 403 al consultar migraciones remotas con sus credenciales actuales, por lo que se usará el conector autorizado de Supabase para registrar la migración.

**Límites de esta versión:** esta protección SQL se centra en el materializador de preinscripciones `INSBAUTI` y `INSCONFI`; otras rutas de procedencia histórica siguen requiriendo auditoría. No se ha demostrado aún el caso positivo de conciliación de boleta reportada contra una partida ficticia previamente celebrada ni la entrega del correo de recuperación. Las verificaciones ficticias no garantizan por sí solas el 100 % de operaciones de usuario final.

### Evidencias

- `AUDITORIA_IMPORTACIONES_SEGURIDAD_V213.json`
- `AUDITORIA_PUERTA_CALIDAD_V213.json`
- `scripts/qa-rollback-legacy-boletas-v213.sql`
- `scripts/qa-rollback-legacy-scope-collision-repro-v213.sql`
- `scripts/qa-rollback-legacy-scope-guard-v213.sql`
- `scripts/test-legacy-scope-isolation-v213.mjs`
