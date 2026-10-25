# SACRAMENTUM FINAL · V203 — Recuperación real tras statement timeout

**Fecha:** 25 de octubre de 2026 (hora Colombia). **Proyecto Supabase:** `foczofcmwampjvlfbsqn`.
**Ruta:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Evidencia del servidor PostgreSQL

Se comprobó un timeout auténtico de PostgreSQL 17.6, no una excepción fabricada por las pruebas. El valor normal observado de `statement_timeout` era **2 minutos**; exclusivamente dentro de cada transacción ficticia se aplicó `SET LOCAL statement_timeout='900ms'`. Este ajuste local **no altera la configuración de producción**.

Se ejecutaron cuatro scripts, uno por sacramento:
- `scripts/qa-rollback-baptism-statement-timeout-v203.sql`;
- `scripts/qa-rollback-confirmation-statement-timeout-v203.sql`;
- `scripts/qa-rollback-marriage-statement-timeout-v203.sql`;
- `scripts/qa-rollback-funeral-statement-timeout-v203.sql`.

Cada uno realizó la misma comprobación en tres etapas:

1. **Control positivo sin cancelar:** dentro de `BEGIN ... ROLLBACK`, con timeout aumentado *solo para el control* a seis segundos, creó una boleta ficticia, ejecutó la RPC oficial, verificó la partida, el estado `seated/reportado` de su boleta, el consecutivo y la traza de `registry_audit_log`. Completó `pg_sleep(2)` y devolvió `SEAT_AND_CONTROL_SLEEP_COMPLETED`. **4/4 controles positivos aprobaron.**
2. **Cancelación real después del asiento:** repitió exactamente la misma secuencia con `statement_timeout='900ms'`. Dentro del `DO` se comprobó que la partida oficial y la boleta ya existían correctamente, *antes* de llamar a `pg_sleep(2)`. PostgreSQL interrumpió la sentencia durante `pg_sleep` y devolvió **SQLSTATE 57014, canceling statement due to statement timeout**, con contexto `PL/pgSQL function inline_code_block`. **4/4 cancelaciones observadas**. El resto de la transacción no llegó a `COMMIT`: quedó abortada y el servidor la descartó.
3. **Recuperación posterior:** la consulta SQL independiente `scripts/qa-verify-post-timeout-recovery-v203.sql` comprobó **0 de 10 clases de residuos**: cuatro tablas de partidas, cuatro de pendientes, parámetros de numeración y entradas de auditoría marcadas como V203. Después de las cancelaciones, se repitieron los cuatro controles positivos con una transacción nueva: **4/4 asientos recuperados correctamente** y todos finalizaron en `ROLLBACK`. La consulta final de residuos volvió a devolver únicamente ceros.

La regresión `scripts/qa-rollback-four-sacrament-seating-v193.sql` también aprobó **4/4** circuitos completos, **4/4** reintentos duplicados rechazados y al menos cuatro constancias jurídicas, íntegramente revertidas.

## Interpretación técnica y límites

**La restauración tras un timeout SQL real queda demostrada para los cuatro procedimientos oficiales**: un asiento que había sido validado y generado dentro de una transacción no persistió cuando PostgreSQL canceló la sentencia antes de confirmar; no quedaron boleta, partida, consecutivo o auditoría huérfanos y la operación pudo repetirse en una transacción nueva.

El timeout se provocó **después de que la RPC devolviera éxito, dentro del mismo bloque transaccional**, durante una espera `pg_sleep`. Esta es una prueba válida de cancelación de una transacción con asiento no confirmado, pero **no** prueba un timeout interno de cada sentencia de las cuatro RPC, un corte de internet ni cómo la interfaz recupera una conexión o informa al usuario.

Las identidades son contextos `SET LOCAL ROLE authenticated` con `request.jwt.claim.sub` simulado, no sesiones de Supabase Auth firmadas independientes. Tampoco hay prueba de dos conexiones realmente solapadas ni de deadlocks.

## Dictamen

**07.09 — Restauración tras timeout: APROBADO en el ámbito transaccional PostgreSQL de los cuatro asientos**, gracias a cuatro cancelaciones reales `57014`, residuos cero y cuatro recuperaciones seguras. Los controles 07.03 (dos usuarios simultáneos), 07.08 (deadlocks) y las pruebas E2E de reconexión de navegador permanecen abiertos y **no se deben deducir de esta evidencia**.

La matriz maestra pasa de **28/325 a 29/325 (8,9 %)** controles certificados. No se han añadido funciones, triggers, permisos ni migraciones; solo scripts y documentación reproducibles.

**Fuente primaria de resultados ejecutados:** `AUDITORIA_TIMEOUT_RESULTADOS_V203.json` y los cuatro scripts SQL. Las pruebas Node agregadas al gate verifican la estructura de esos contratos, pero no ejecutan `statement_timeout` desde GitHub Actions: la ejecución real se hizo con el conector Supabase.
