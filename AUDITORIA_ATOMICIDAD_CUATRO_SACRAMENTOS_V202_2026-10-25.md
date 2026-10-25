# SACRAMENTUM FINAL · V202 — Atomicidad completa de los cuatro asientos sacramentales

**Fecha:** 25 de octubre de 2026 (Colombia). **Proyecto Supabase:** `foczofcmwampjvlfbsqn`.
**Carpeta auditada:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Objetivo y límites
Completar la prueba SQL de atomicidad que V201 había dejado pendiente para Matrimonio y Exequias. Las pruebas se hicieron contra las **RPC de producción** `create_pending_marriage`, `create_pending_funeral`, `seat_pending_marriage` y `seat_funeral_record`, usando exclusivamente expedientes ficticios dentro de `BEGIN ... ROLLBACK`.

Los contextos `authenticated` y `request.jwt.claim.sub` se simularon dentro de PostgreSQL, sin conexiones de usuario reales de Supabase Auth. La prueba demuestra atomicidad de la transacción PostgreSQL; no pretende certificar red, tiempo de espera de conexión, dos sesiones físicas simultáneas ni concurrencia con JWT independientes.

## Caso A · Fallo deliberado después de crear la partida oficial

Ensayo ejecutado: `scripts/qa-rollback-marriage-funeral-atomicity-v202.sql`.

Para cada sacramento:
1. Preparar en memoria una boleta ficticia y los parámetros de un libro de QA no usado (`9883`).
2. Ejecutar correctamente el asiento mediante su RPC, y verificar **dentro de una subtransacción** que la partida oficial existe y la boleta está asentada.
3. Lanzar deliberadamente la excepción `QA202_FORCED_FAILURE_AFTER_SUCCESS`, después de terminar la RPC, antes de confirmar la transacción.
4. Capturar la excepción y comprobar que PostgreSQL deshizo completamente la partida oficial, el cierre de boleta y el cambio de consecutivo.
5. Consultar la auditoría desde un contexto autorizado separado de `authenticated`: **cero** constancias jurídicas fantasma.
6. Reintentar el asiento desde la misma boleta, ya conservada como pendiente: **correcto**; repetir la RPC sobre esa misma boleta: **rechazado por duplicación**.
7. Comprobar finalmente **dos asientos legales** con **dos entradas exactas** en `registry_audit_log`.

Resultados observados en Supabase: **2/2 fallos controlados con rollback íntegro; 0 auditorías fantasma; 2/2 recuperaciones; 2/2 duplicados rechazados; 2 auditorías finales**. Transacción exterior `ROLLBACK`.

La excepción se inyectó después de terminar la RPC, no en el interior de su SQL. Por eso acredita especialmente la reversión completa cuando falla la transacción que contiene el asiento, pero no equivale a inyectar un fallo dentro del procedimiento en cada sentencia.

## Caso B · Dos boletas consecutivas por sacramento

Ensayo ejecutado: `scripts/qa-rollback-marriage-funeral-sequential-v202.sql`.

En libro ficticio `9884`, folio 1, número 1, se crearon dos boletas distintas por cada sacramento:
- **4/4** asientos oficiales generados con números 0001 y 0002 y avance del siguiente folio/consecutivo al número 3.
- **4/4** reintentos de doble asiento correctamente rechazados.
- Ambas boletas quedaron correctamente cerradas y reportadas; exactamente dos constancias de auditoría por sacramento.
- Todas las mutaciones finalizaron con `ROLLBACK`.

Estas solicitudes fueron secuenciales, no dos procesos físicamente simultáneos.

## Caso C · Regresión completa de cuatro sacramentos

Se ejecutó nuevamente `scripts/qa-rollback-four-sacrament-seating-v193.sql`: **4/4** circuitos de Bautismo, Confirmación, Matrimonio y Exequias, **4/4** reintentos duplicados rechazados y **4** trazas de auditoría. También sigue documentada la V201: **2/2 fallos durante la segunda boleta de un lote de Bautismo y Confirmación**, con cuatro pendientes preservados, sin partidas parciales, sin adelantos de consecutivo y asientos correctos al corregir los datos.

## Integridad posterior

Consulta SQL independiente, realizada después de los rollbacks:
- **0** partidas de Matrimonio o Exequias con libros ficticios 9883/9884.
- **0** boletas QA-V202.
- **0** cambios persistentes de parámetros de dichos libros.
- No hubo ninguna migración ni modificación del código funcional productivo, ni de permisos de usuario.

## Dictamen de auditoría

**07.06 — Transacción atomicidad: APROBADO**, para el asiento en los cuatro sacramentos y su combinación boleta, partida, parámetros de numeración y traza registral; se dispone ahora de ensayos de rollback sobre los cuatro procedimientos de asiento.

Permanecen **EN_PROGRESO** 07.03 (concurrencia de dos usuarios) y 07.05 (cobertura global de reintentos); **PENDIENTE** 07.08 (bloqueos/deadlocks) y 07.09 (recuperación tras timeout real). No se afirma cubrirlos con las pruebas V202.

La matriz maestra pasa de **27/325** a **28/325 APROBADOS ≈ 8,6 %**. El nuevo test de contrato `scripts/test-marriage-funeral-atomicity-v202.mjs` se integra a la puerta general de calidad y se mantiene separado de los ensayos PostgreSQL reales aquí descritos.
