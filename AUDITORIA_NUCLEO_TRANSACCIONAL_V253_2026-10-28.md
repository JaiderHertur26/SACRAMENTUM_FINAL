# SACRAMENTUM FINAL — V253 · Núcleo transaccional aislado y conciliación de libros

**28 de octubre de 2026. Proyecto SACRAMENTUM FINAL.** La V253 extiende la rama de trabajo V252/PR #103. NO se ha fusionado a main, NO se ha desplegado en Vercel, y NO se ha ejecutado ninguna migración en Supabase.

## Revisión de los libros existentes (solo lectura en Supabase QA)

Se consultaron únicamente agregados de las tablas baptisms, confirmations, marriages y funerals, agrupados por parroquia, sacramento, tipo y Libro (sin exportar nombres de personas ni contenido sacramental). Se hallaron **8.393 registros con Libro/Folio/Partida** en **22 ámbitos de libro**. En 11 ámbitos hay discontinuidad de números o repetición de números globales, por lo que no deben asumirse secuencias continuas. Los otros 11 ámbitos presentan numeración continua, pero aún necesitan revisión del folio, capacidad, estatus y la fuente documental.

La evidencia agregada se conserva en AUDITORIA_CONCILIACION_LIBROS_V253_2026-10-28.json, sin identificadores privados. **Ningún libro de la base QA ha sido migrado o habilitado**; se marcarán como pendientes de conciliación por defecto.

## Implementación transaccional (exclusivamente fixture PostgreSQL16)

- scripts/qa-v252-ledger-memory-schema.sql: libros por parroquia, sacramento, tipo y código alfanumérico exacto; configuración congelada tras primer asiento; memoria con versión de concurrencia y flag fail-closed legacy_reconciled=false.
- scripts/qa-v253-ledger-transactions.sql: dos funciones PRIVADAS de simulación qa_append_batch_v253 y qa_reverse_tail_v253, invocables únicamente por el propietario de la base fixture, no por la API de Supabase. Bloquean la memoria FOR UPDATE; exigen versión esperada, ordenan cronológicamente, comprueban boletas de ensayo, rechazan números repetidos, asientan lote y actualizan memoria + evento en la misma transacción. Las solicitudes repetidas con mismo operation_id devuelven exactamente el mismo resultado; otra solicitud con esos datos o con versión obsoleta falla.
- Reversión del sufijo terminal con motivo y autorización declarados, rechazo de partidas intermedias y comprobación de dependencias guardadas en tabla PRIVADA. El evento histórico permanece aunque el vínculo activo se quite. Es una SIMULACIÓN: las referencias de documentos son ficticias, no hay autorización institucional ni vínculo con registros parroquiales reales.
- scripts/ci-ledger-transactions-v253.sh: compara resultados, rechazos, ausencia de saltos, reversión dependiente y carrera real entre dos sesiones PostgreSQL que intentan usar el mismo siguiente asiento. Debe aprobar SOLO una, sin doble adjudicación.
- scripts/test-transactional-ledger-v253.mjs: regresiones estáticas, más las de V252. Todo pasa por audit:master y GitHub Actions.

## Faltantes obligatorios para activación

1. Conciliación histórica completa por cada uno de los 22 ámbitos. Los datos QA son ficticios, pero la misma metodología deberá aplicarse a los libros auténticos antes de su importación.
2. Reemplazar el payload ficticio por selecciones de boletas reales que se bloqueen y validen en base, en vez de confiar en la marca verified enviada por navegador.
3. Implementar las cuatro operaciones completas de escritura que enlazan partida histórica, boleta, auditoría y memoria atómicamente, con verificación de usuarios activos, parroquia/diocese, RLS y permisos mínimos.
4. Proteger contra rutas laterales actuales de asignación automática desde Parámetros y generación en Cancillería; después convertir Parámetros en consulta salvo contador de boletas.
5. Vincular todos los certificados, notas, decretos y notificaciones reales a las dependencias y a la reversión excepcional, y exigir autorización genuina en base, no una cadena enviada por cliente.
6. Verificar reversión real y salida de decretos en su orden institucional antes de habilitar V252/V253 en main o Supabase.

**Criterio de corte:** no se autoriza un despliegue funcional parcial. Esta implementación simulada no puede crear, anular ni renumerar ninguna partida auténtica.
