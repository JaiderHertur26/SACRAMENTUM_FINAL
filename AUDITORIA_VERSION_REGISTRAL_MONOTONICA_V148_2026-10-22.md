# SACRAMENTUM — ACTUALIZACIÓN MONÓTONA DE PARTIDAS Y CONTROL DE COPIAS DESACTUALIZADAS · V148

## Hallazgo comprobado
- La versión registral de Baptisms y Confirmations no siempre avanzaba tras UPDATE; el trigger sacramentum_normalize_legacy_record_before_write no asignaba updated_at. El ensayo pre-fix modificó nombres ficticios y el timestamp permaneció sin cambios, demostrando que la protección de copia de V143 podía ser insuficiente.
- En Matrimonios y Exequias existía trigger sacramentum_set_updated_at(), pero utiliza now(), constante dentro de una misma transacción; no garantiza versión distinta en dos modificaciones sucesivas dentro de la transacción.
- Reproducción V148 en scripts/qa-rollback-stale-record-version-baseline-v148.sql; error de laboratorio V148-CONFIRMED y reversión automática. No hubo cambios reales.

## Reparación aplicada en Supabase
- Migración real supabase/migrations/20261022185717_monotonic_sacramental_record_version_v148.sql.
- Disparador zz_sacramentum_record_version_v148 en cada tabla baptisms, confirmations, marriages y funerals, BEFORE UPDATE. Usa GREATEST(clock_timestamp(), OLD.updated_at + 1 microsecond).
- Ubicación alfabética posterior a los triggers existentes garantiza que una reescritura anterior de updated_at no prevalezca. La función está en esquema private y no concede EXECUTE directo a authenticated.
- No se realizó UPDATE masivo ni backfill de filas históricas; solo las futuras modificaciones disparan el incremento.

## Validación reversible
- scripts/qa-rollback-monotonic-version-all-sacraments-v148.sql prueba cuatro sacramentos: INSERT ficticio, dos cambios sucesivos, intento de forzar updated_at=2000-01-01 y cotejo de tres versiones estrictamente crecientes.
- Para cada sacramento la función de impresión rechazó el timestamp obsoleto y aceptó el más reciente, con libro, folio, número y estado idénticos. Total 4 casos de rechazo y 4 de aceptación.
- Repetidas como regresión SQL: qa-rollback-baptism-confirmation-v115.sql, qa-rollback-print-optimistic-coordinates-v143.sql, qa-rollback-registry-print-four-sacraments-v141.sql, qa-rollback-print-request-lineage-v144.sql. PASS.
- Finalizada cada QA con ROLLBACK. Consulta final: 0 partidas/impresiones ficticias. Ocho eventos históricos de impresión y archivo ANULACION 5 pendientes y 2 vinculados intactos.

## Puerta de calidad e inventario
- scripts/test-monotonic-sacrament-version-v148.mjs contiene 19 pruebas permanentes añadidas a gate y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V148.json: 836/836 sintéticas y 28/28 verificaciones estrictas; npm audit producción/completo con 0 vulnerabilidades, build CSS y Vite OK.
- RPC privilegiadas: 136, con 21 pruebas parciales y 115 pendientes.
- Plan maestro: 19 controles con evidencia V148, estado {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

## Límites expresos
- Las pruebas del control de versiones son transaccionales con datos inventados y usuario authenticated simulado. No se certificó concurrencia real con dos conexiones físicas independientes; sigue pendiente.
- Esta corrección no reemplaza validación de nota marginal nueva después de la solicitud, render final del navegador y verificación de salida en papel.
- El frontend de las últimas versiones de auditoría sigue sin desplegarse. Cualquier pantalla que carezca de updated_at no aprovecha la comprobación temporal opcional de V143; queda pendiente revisar todos los cargadores UI reales.

**Dictamen:** defecto de versión registral reproducido y corregido, en cuatro sacramentos, sin cambios históricos ni permisos añadidos. Concurrencia auténtica y revisión de cargadores de UI siguen abiertos.
