# SACRAMENTUM FINAL — V200 · Unicidad registral segura y examen de concurrencia

**Corte:** 24 de octubre de 2026 en Colombia (consultas DB en UTC 25 de octubre).
**Ruta canónica:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`. **Proyecto Supabase:** `foczofcmwampjvlfbsqn`.

## Propósito
Reducir el riesgo de dos partidas que ocupen el mismo Libro, Folio y Número, incluso si sus números llegaron con ceros a la izquierda, espacios externos o diferente formato. La verificación se basa en **restricciones PostgreSQL válidas**, no solamente en la interfaz de usuario.

## Estado anterior y nueva protección
Ya existían índices únicos para las referencias textuales y funciones de asiento institucionales con `SELECT ... FOR UPDATE` sobre parámetros parroquiales y pendientes. Esto da una defensa importante, pero `'1'` y `'0001'` no son iguales como texto para los índices de V188.

Antes del cambio se buscó equivalencia numérica, sin encontrar grupos repetidos. El conjunto de **8.393 partidas** incluye 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios y una Exequia; todas tenían coordenadas numéricas completas al corte.

Se aplicó a Supabase la migración `20261025012000_registry_numeric_location_unique_v200.sql`:
- Índice único `uq_baptisms_numeric_location_v200`.
- Índice único `uq_confirmations_numeric_location_v200`.
- Índice único `uq_marriages_numeric_location_v200`.
- Índice único `uq_funerals_numeric_location_v200`.

Para cada sacramento se normalizan únicamente referencias numéricas mediante `ltrim(btrim(valor), '0')`, preservando el texto guardado. Bautismo y Confirmación se separan por parroquia; Matrimonio y Exequias, por parroquia y tipo de libro. Las referencias históricas no numéricas continúan controladas por las reglas anteriores.

**La verificación del catálogo confirmó 4/4 índices UNIQUE válidos** y una consulta posterior encontró 0 duplicaciones numéricas equivalentes entre las 8.393 partidas; no se alteró ningún registro existente.

## Pruebas reales de PostgreSQL — ROLLBACK
`scripts/qa-rollback-numeric-unique-four-sacraments-v200.sql` inserta documentos exclusivamente ficticios en una transacción reversible y verifica:
- **4/4 intentos duplicados denegados con `unique_violation` del índice V200 correcto**: coordenadas `009877 / 00442 / 00888` frente a `9877 / 442 / 888` en la misma parroquia y libro.
- **4/4 inserciones legítimas en otra parroquia aceptadas**, con idéntica coordenada.
- **2/2 inserciones legítimas en tipo de libro suplementario aceptadas** para Matrimonio y Exequias.
- **0 residuos de QA** tras `ROLLBACK` en las cuatro tablas.

Se repitió `scripts/qa-rollback-four-sacrament-seating-v193.sql` tras la migración: **4/4 circuitos completos** de boleta a partida, boleta archivada y traza; **4/4 reintentos rechazados**. No hubo regresión de los cuatro procedimientos oficiales.

## Concurrencia realmente solapada: continúa sin acreditación
Se verificó que las cuatro funciones de asiento tienen `FOR UPDATE` y que todas cuentan con índices únicos que impiden duplicar las coordenadas. La unicidad del índice se aplica por el propio motor PostgreSQL incluso en inserciones competidoras.

Se lanzaron dos peticiones SQL de prueba de advisory lock, con dos backends distintos y una ventana de ocho segundos. Sin embargo, el contendiente comprobó el bloqueo **después de finalizar la transacción titular**, por lo que adquirió el lock: no existió contención simultánea observable. No se tratará ese ensayo como aprobación de carreras entre usuarios.

**No hay dos sesiones Auth parroquiales de prueba vigentes ni credenciales directas PostgreSQL disponibles en el entorno de trabajo**. Sigue pendiente un ensayo con dos conexiones realmente simultáneas, dos JWT válidos y comportamiento de reintento/timeout en navegador. No se habilitó acceso anónimo adicional ni se crearon credenciales de producción para simular el resultado.

## Calidad y certificación
- `scripts/test-numeric-unique-locations-v200.mjs` agrega cinco pruebas contractuales a la puerta de calidad.
- `scripts/qa-verify-numeric-registry-integrity-v200.sql` permite repetir el control de duplicados e índices desde lectura.
- La migración fortalece el control **07.01 — Unicidad Libro Folio Número** (ya estaba APROBADO), sin promover por ello el 07.03 (dos usuarios concurrentes), 07.08 (deadlocks) ni 07.09 (timeout).
- **El plan maestro mantiene 27/325 controles APROBADO (8,3%)** hasta contar con evidencias adicionales.

Toda la intervención SQL de producción consistió en nuevos índices UNIQUE. **No se editó ni renumeró ninguna partida histórica.**
