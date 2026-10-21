# SACRAMENTUM V100–V101 | Aislamiento del Centro de Migración

**Fecha:** 21 de octubre de 2026. **Entorno:** Supabase REGISTRO SACRAMENTOS. **Método:** simulación de sesiones `authenticated`, pruebas de funciones reales, RLS y registros ficticios en transacciones con `ROLLBACK`.

## Hallazgo V100-SEC-009 — Permisos incongruentes en importaciones históricas

Se comprobó que `public.can_manage_legacy_import` retornaba `true` al Administrador General para lotes de cualquier parroquia y `false` a la Parroquia propietaria. Resultado prepatch sobre la misma parroquia: admin=true, Diócesis=true, Parroquia=false.

Las políticas de SELECT originales sobre `legacy_import_batches`, `legacy_import_rows` y `legacy_record_links` también contenían excepciones generales para Administrador General. Este comportamiento contradice la jerarquía de gestión documental: la Parroquia custodia sus sacramentos, Diócesis supervisa su jurisdicción y Cancillería consulta el archivo para su función específica.

**Migración aplicada:** `supabase/migrations/20261021203322_scope_legacy_migration_roles_v100.sql`.

Corrección: `can_manage_legacy_import(parish_id,diocese_id)` permite gestionar a Parroquia únicamente su propia `parish_id`, y a Diócesis únicamente las parroquias de su diócesis o sus fuentes diocesanas. Ya no admite a Admin General ni Cancillería para gestión. Las tres políticas SELECT se actualizaron para limitar lectura a la autoridad de gestión o a la Cancillería de la misma diócesis.

**Matriz postparche:**

| Rol | Gestionar lote de Parroquia propia/de la Diócesis | Consultar lotes | Consultar filas y vínculos |
| --- | --- | --- | --- |
| Administrador General | Denegado | 0 visibles | 0 visibles |
| Diócesis | Permitido territorialmente | 42 | 16.331 filas / 11.734 vínculos |
| Cancillería | Denegado | 42 | 16.331 filas / 11.734 vínculos |
| Parroquia | Permitido sólo propia | 20 | 3.292 filas / 3.183 vínculos |

Los conteos corresponden a los usuarios y datos del ensayo, y no son permisos globales. Se hizo una prueba horizontal adicional con un lote existente de **otra parroquia**: la sesión de Parroquia pudo ver sus propios lotes, pero obtuvo **0** lotes ajenos, **0** filas ajenas y **0** vínculos ajenos.

### Límites de V100

Los 11.734 vínculos existentes poseían `batch_id`; la política se puede limitar al lote sin perder referencias. No se cambiaron datos históricos ni se vació ninguna tabla. No se ha ejecutado todavía una restauración completa en un segundo entorno aislado.

## Hallazgo V101-SEC-010 — Puerta de creación sin ámbito

Tras V100 permanecía un permiso residual dentro de la RPC `public.create_legacy_import_batch`: si no se elegía Parroquia, la rama `if v_role='admin_general' then null` autorizaba abrir lotes sin jurisdicción. Se reprodujo con un perfil de reportes `REPORTES_FRX` y archivo ficticio, dentro de BEGIN/ROLLBACK.

**Migración aplicada:** `supabase/migrations/20261021212613_block_unscoped_admin_legacy_batch_v101.sql`.

Se reemplazó únicamente la excepción del Administrador General dentro de la función existente, conservando firma, permisos, registro de auditoría y la creación diocesana autorizada. La migración aborta si el patrón no coincide exactamente con la definición auditada.

**Pruebas posteriores:** Admin General no pudo crear lote sin ámbito; Diócesis sí creó un lote propio para `REPORTES_FRX`; Parroquia creó lote de `BAUTIZOS` en su parroquia; la misma Parroquia no pudo crear uno para una parroquia ajena. Todo reversible y sin lotes persistidos.

## Operación integral con la sesión Parroquia

Para validar el efecto de V100–V101 sobre el uso cotidiano de la aplicación:

1. Una sesión con rol Parroquia creó un lote `CPTOANULA` con `create_legacy_import_batch`.
2. Cargó una fila sintética por `stage_legacy_import_rows`.
3. Aplicó la importación por `apply_legacy_import_batch_v3` (la RPC utilizada por el servicio web).
4. Se confirmó una fila `imported`, concepto `source_kind='legacy_catalog'` y referencia `legacy_batch:<batch>/row:<row>`.
5. Un intento de Admin General de ejecutar ese lote fue denegado.
6. Se revirtió la transacción. Comprobación final: **0** lotes, **0** filas y **0** conceptos de prueba.

Las pruebas V99 de la importación histórica y la preservación de procedencia son complementarias y permanecen vigentes.

## Prevención de regresión

- `scripts/test-legacy-role-scope-v100.mjs`: 8 pruebas de roles, ámbito, lectura RLS y conservación de datos.
- `scripts/test-legacy-admin-unscoped-v101.mjs`: 5 pruebas de firma, sustitución acotada, falla cerrada y conservación de privilegios.
- V99 aporta 7 pruebas adicionales. El conjunto completo esperado tras V101 es **284 pruebas sintéticas**, más verificadores heredados, build y control estricto de dependencias.

**Pendientes:** recorridos de pantalla autenticados con pruebas visuales, importaciones masivas en sandbox, concurrencia, trazabilidad de archivos descargados, auditoría RPC restante, pruebas de recuperación de respaldo, y cinco alertas HIGH de dependencias. La seguridad del Centro de Migración no está certificada integralmente.
