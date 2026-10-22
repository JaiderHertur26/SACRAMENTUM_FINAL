# SACRAMENTUM · AISLAMIENTO DE NOTAS Y BLOQUEO DE ANULACION ANTIGUA · V125–V126

## Hallazgo P0: notas matrimoniales fuera de la jurisdicción
- Función public.reconcile_legacy_matrimonial_notes(uuid) aceptaba parámetro parroquia NULL. El control de autorización sólo se aplicaba cuando se recibía un id de parroquia.
- Un usuario Parroquia podía procesar una nota matrimonial histórica de otra parroquia incluso si no tenía permisos sobre ella. Se reprodujo con una fila ajena QA; el fallo terminó con ROLLBACK.
- V125 corrigió la autorización: requiere usuario autenticado, parroquia explícita, y autorización can_manage_legacy_import antes de cualquier bucle.
- Prueba positiva/negativa tras la corrección: la propia fila se concilió, la ajena permaneció intacta, y Parroquia ajena/Admin General/Cancillería recibieron rechazo 42501.

## Hallazgo P0: ejecución heredada de decretos ANULACION
- Dos lotes ANULACION reales están en estado ready con cinco filas status valid en conjunto. Cinco antecedentes permanecen en archivo histórico pendientes y dos ya están vinculados.
- El viejo apply_legacy_import_batch_v3 delegaba en reconcile_legacy_anulacion_batch, función que actualizaba directamente la vigencia de partidas y creaba o alteraba decretos sin la ruta V118.
- V126 protege cuatro entradas: apply_legacy_import_batch, apply_legacy_import_batch_v2, apply_legacy_import_batch_v3 y reconcile_legacy_anulacion_batch.
- Las cuatro rechazan ANULACION con error SQL 42501 y conservan las filas pendientes. El servicio frontend src/services/legacyMigrationService.js explica el traslado a Cancillería antes de invocar la RPC.
- La vía vigente y segura para expediente documental es Cancillería / Centro de Decretos / Conciliación de decretos antiguos V118. No se ha implantado un nuevo módulo de ejecución jurídica final; sigue pendiente revisión institucional caso a caso.

## Ensayos y estado
- scripts/qa-rollback-matrimonial-notes-global-scope-v125.sql: reproducción y prueba de no-regresión del alcance global.
- scripts/qa-rollback-matrimonial-notes-parish-authority-v125.sql: una propia, otra ajena, tres rechazos por rol, comprobación de fila intacta.
- scripts/qa-rollback-block-legacy-anulacion-v126.sql: cuatro RPC rechazadas ante un lote real sin modificar estado ni filas, final ROLLBACK.
- Supabase V125/V126 aplicadas. Versiones locales: 20261022140436 y 20261022140953.
- Consulta final confirmó: dos lotes ready, cinco filas valid, cinco históricos archived, dos vinculados, 76 notas matrimoniales matched, cero notas ficticias residuales o filas de error involuntarias.
- AUDITORIA_PUERTA_CALIDAD_V126.json: 574 pruebas sintéticas, 25/25 verificaciones y compilación.

## Auditoría de RPC
- AUDITORIA_RPC_PRIVILEGIADAS_V123.json sigue conteniendo 133 funciones. 7 tienen verificaciones parciales concretas; 126 pendientes sin estas pruebas.
- El estado parcial NO implica funciones completamente certificadas: sólo cubre controles específicos. Quedan revisar mutaciones, nulidad judicial, migración y permisos históricos.

## Riesgos de cierre
- La nulidad matrimonial exige estudiar la RPC apply_marriage_nullity y su integración con comprobaciones judiciales V107-V112 antes de permitir su uso sin riesgo jurídico.
- Las 64 advertencias GraphQL, default ACL de supabase_admin, leaked password protection y npm audit no están cerradas.
- Sin validación visual autenticada completa ni despliegue de esta rama.

## Plan maestro
- Se agregaron evidencias a 19 controles: {"APROBADO":9,"EN_PROGRESO":102,"PENDIENTE":213,"FALLIDO":1}. Ningún control global cambió a APROBADO sólo por esta fase.

**Dictamen:** dos vías de mutación indebida demostradas y protegidas; conservación histórica confirmada; aplicación en auditoría continua.
