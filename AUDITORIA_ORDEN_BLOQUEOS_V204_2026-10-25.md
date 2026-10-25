# SACRAMENTUM FINAL · V204 — Orden homogéneo de bloqueos de asiento sacramental

**Fecha:** 25 de octubre de 2026, Colombia. **Proyecto:** Supabase `foczofcmwampjvlfbsqn`.
**Ruta de trabajo:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Riesgo identificado en los procedimientos reales

Se inspeccionó `pg_get_functiondef` de las cuatro funciones `SECURITY DEFINER` de asiento:
- Bautismo y Confirmación bloqueaban primero `public.parish_parameters` mediante `FOR UPDATE`, y posteriormente la boleta pendiente.
- Matrimonio y Exequias bloqueaban primero `public.pending_marriages` o `public.pending_funerals` mediante `FOR UPDATE` y **después** `public.parish_parameters`.

Los cuatro asientos comparten la fila `parish_parameters` de la misma parroquia. La diferencia de orden es un **riesgo preventivo de bloqueo y contención** cuando se combina con otras funciones que usan recursos compartidos. **No se ha reproducido un deadlock atribuible a esta diferencia**; no es correcto afirmar que existía un incidente de deadlock ya confirmado.

`pg_stat_database.deadlocks` mostró **0** en la base `postgres` al corte, dato histórico agregado que tampoco puede garantizar ausencia de futuros ciclos.

## Solución V204 aplicada a Supabase

Migración de base aplicada: `20261025221000_uniform_parish_seat_lock_order_v204.sql`.

Se mantuvieron los cuerpos originales completos de `seat_pending_marriage(uuid)` y `seat_funeral_record(jsonb,uuid)`, insertando únicamente una adquisición temprana de `parish_parameters ... FOR UPDATE` **después de comprobar el rol parroquial activo y antes de leer la boleta pendiente**. Las dos funciones conservan sus firmas, salida jurídica, validaciones, auditoría y lógica de consecutivos.

La primera ejecución fue una prueba de definición dentro de `BEGIN ... ROLLBACK`, que confirmó que ambas funciones se podían reemplazar y mostraban el nuevo bloqueo. Posteriormente se aplicó la migración y se verificó en los metadatos reales de PostgreSQL:

- **4/4** funciones: referencia a `parish_parameters` anterior a la boleta pendiente.
- **4/4**: `SECURITY DEFINER` conservado.
- **4/4**: `search_path=public` previamente fijado, sin modificación.
- **4/4**: lista ACL igual a `postgres`, `authenticated`, `service_role`. `anon` continúa sin permiso de ejecución.
- Se guardaron las dos definiciones originales en `scripts/qa-restore-previous-lock-order-v204.sql`, como ruta explícita para revertir la migración si fuera necesario. **No ejecutar esa restauración en operación normal**.

La consulta read-only reproducible es `scripts/qa-readonly-parish-seat-lock-order-v204.sql`.

## Comprobaciones reales posteriores de regresión SQL

Tras instalar V204, se ejecutaron contra Supabase:
- `scripts/qa-rollback-marriage-funeral-atomicity-v202.sql`: **2/2** asientos revertidos íntegramente tras fallo inyectado, **0** trazas fantasma, **2/2** reintentos seguros y dos trazas finales.
- `scripts/qa-rollback-marriage-funeral-sequential-v202.sql`: **4/4** asientos consecutivos en Matrimonio y Exequias con números distintos, **4/4** reintentos duplicados rechazados.
- `scripts/qa-rollback-four-sacrament-seating-v193.sql`: **4/4** circuitos boleta → partida → auditoría correctos, **4/4** duplicaciones rechazadas.
- `scripts/qa-rollback-stale-client-numbering-v201.sql`: **2/2** segundos clientes con consecutivo antiguo rechazados y **2/2** recuperaciones correctas.
- Se reprodujo nuevamente el **timeout real SQLSTATE 57014** en Matrimonio y Exequias (`scripts/qa-rollback-*-statement-timeout-v203.sql`), después de confirmar que la partida y la boleta existían en la transacción. **2/2** cancelaciones correctas y **0** boletas o partidas QA persistentes al final.

Todos los datos eran ficticios y se ejecutaron dentro de transacciones con `ROLLBACK` o cancelación de transacción. No se modificaron registros históricos ni se alteraron permisos.

## Límite: todavía no existe un ensayo con dos conexiones realmente simultáneas

- Los intentos previos de hacer dos consultas en paralelo por el conector Supabase no demostraron superposición.
- Se probó la posibilidad de una conexión auxiliar `dblink` **exclusivamente dentro de `BEGIN ... ROLLBACK`**, pero PostgreSQL rechazó la conexión sin contraseña con **SQLSTATE 2F003**. La extensión no quedó instalada.
- El equipo Windows conectado no tiene servidor PostgreSQL local, `psql`, Docker ni una distribución WSL instalada. Tampoco se dispone de dos JWT Auth parroquiales vigentes.
- No se instalaron extensiones persistentes ni se crearon contraseñas privilegiadas artificiales para simular dos sesiones.

**07.08 — Bloqueos y deadlocks queda EN_PROGRESO:** el riesgo de orden invertido queda mitigado, pero no está acreditada una contención real ni un deadlock detectado y resuelto. **07.03 — Concurrencia de dos usuarios permanece EN_PROGRESO.**

## Estado de la certificación

Se añaden cinco pruebas contractuales a `scripts/audit-gate-v90.mjs`; no deben confundirse con las ejecuciones reales de los scripts SQL. La matriz se mantiene en **29 de 325 controles APROBADOS (8,9 %)**: esta intervención corrige una inconsistencia técnica real, pero no certifica una prueba que no se pudo ejecutar.

**Archivos:** migración V204, reversión V204, verificación SQL de solo lectura, prueba Node, JSON de resultados y este informe. Ningún dato histórico ni permiso de usuario fue alterado.
