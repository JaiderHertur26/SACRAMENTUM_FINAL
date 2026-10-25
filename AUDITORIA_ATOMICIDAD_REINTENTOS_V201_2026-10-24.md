# SACRAMENTUM FINAL · V201 — Atomicidad real de lotes y recuperación de numeración desactualizada

**Corte de auditoría:** 24 de octubre de 2026, hora de Colombia (servidor UTC ya marca 25 de octubre).
**Proyecto:** Supabase `foczofcmwampjvlfbsqn`.
**Repositorio local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Alcance probado de verdad en PostgreSQL
Los ensayos emplearon las **RPC de producción** `create_pending_baptism`, `create_pending_confirmation`, `seat_baptism_records` y `seat_confirmation_records`, bajo `SET LOCAL ROLE authenticated` y un contexto de usuario parroquial activo construido desde datos de prueba, todo dentro de una transacción externa con `ROLLBACK`.

**Importante:** la configuración de sub JWT en PostgreSQL es simulada y no constituye un inicio de sesión válido de Supabase Auth. Los ensayos no usaron dos conexiones solapadas: ese es un control de concurrencia distinto.

### Caso A · Falla después de procesar la primera boleta
SQL reproducible: `scripts/qa-rollback-batch-atomicity-v201.sql`.

Por cada uno de Bautismo y Confirmación:
1. Se crearon dos boletas ficticias, una con fecha válida y la segunda con una fecha de celebración futura inválida. Se estableció libro especial ficticio `9881`, folio 1, número 1.
2. Se llamó una sola vez al procedimiento oficial de asiento pasando **ambas boletas en un mismo lote**. La RPC comienza por la primera, pero falla cuando encuentra la segunda.
3. **2/2 RPC de lote fallaron sin dejar partidas oficiales**, ambas boletas de cada sacramento permanecieron `pending` y no reportadas: **4/4 pendientes conservados**.
4. El consecutivo de Libro/Folio/Número no avanzó durante el error.
5. Tras corregir solamente la fecha de la segunda boleta ficticia, se reintentó el mismo lote: **2/2 lotes completos exitosos**, con dos partidas y dos boletas cerradas por sacramento.
6. Cada libro ficticio pasó de folio 1, número 1 a folio 2, número 3; se obtuvieron **exactamente 4 asientos de auditoría** al cerrar la transacción ficticia. No hubo constancias fantasma de la operación fallida.
7. `ROLLBACK` externo; ninguna partida ni boleta definitiva.

**Resultado importante:** una falla en la segunda boleta no deja la primera falsamente asentada ni consume numeración.

### Caso B · Dos clientes con la misma numeración antigua
SQL reproducible: `scripts/qa-rollback-stale-client-numbering-v201.sql`.

Para cada uno de Bautismo y Confirmación se simularon dos clientes que habían consultado simultáneamente en la interfaz el libro `9882`, folio 1, número 1:
1. El primer cliente asentó una boleta, generando el número 1 y avanzando el siguiente a 2.
2. El segundo intentó asentar **su boleta diferente con coordenadas antiguas**. El servidor respondió correctamente que el consecutivo cambió: **2/2 rechazos por datos desactualizados**, sin crear una segunda partida.
3. La segunda boleta permaneció pendiente. Tras actualizar la numeración, se creó exactamente la partida número 2 y la siguiente coordenada quedó en folio 2, número 3: **2/2 recuperaciones satisfactorias**.
4. Se verificaron dos trazas de asiento por sacramento, ninguna adicional; fin con `ROLLBACK`.

**Límite:** estas solicitudes se hicieron secuencialmente para representar dos vistas obsoletas, **no** fueron dos conexiones PostgreSQL físicas con locks simultáneos.

### Regresión posterior de cuatro sacramentos
Se repitió `scripts/qa-rollback-four-sacrament-seating-v193.sql` sobre la base ya reforzada por V199/V200:
- **4/4 circuitos boleta → asiento → partida → traza jurídica**.
- **4/4 reintentos de doble asiento correctamente rechazados**.
- Cuatro trazas jurídicas generadas dentro de la transacción y luego revertidas.

### Limpieza y control de permisos
Se consultó el estado fuera de las transacciones:
- 0 partidas Bautismo/Confirmación para libros QA `9881` y `9882`.
- 0 boletas QA-V201.
- 0 parámetros parroquiales residuales de esos libros.
- 0 constancias de asiento QA en `registry_audit_log`.

En la primera revisión, el rol `authenticated` no podía leer directamente `registry_audit_log` (**permiso denegado**, comportamiento correcto); la verificación jurídica se trasladó al contexto administrador después de `RESET ROLE`. **No se concedieron ni modificaron privilegios.**

## Aspectos todavía no acreditados
- Dos usuarios parroquiales con JWT Supabase realmente independientes actuando simultáneamente.
- Contención de bloqueos entre dos backends, deadlocks, tiempo de espera del cliente, reinicio tras `statement_timeout` real.
- Fallo inducido después del paso de escritura para los procedimientos unitarios de Matrimonio y Exequias (la regresión funcional normal sí pasó).

## Estado del plan maestro
Los controles `07.05` (reintento), `07.06` (atomicidad) y `07.09` (recuperación tras timeout) siguen sin una aprobación global: dos sacramentos están bien comprobados para fallo a mitad de lote, pero Matrimonio/Exequias requieren cobertura equivalente y ningún timeout real fue validado. `07.03` (concurrencia entre dos usuarios) y `07.08` (deadlocks) permanecen pendientes de dos conexiones físicas realmente solapadas.

**Certificación general: 27/325 controles aprobados (8,3%)**, sin modificar la aplicación funcional ni la base histórica.

## Puerta de calidad
`scripts/test-atomic-batch-and-stale-recovery-v201.mjs` incorpora cinco contratos adicionales de calidad. **1.521/1.521 pruebas Node** y **30/30 verificaciones integrales** aprobaron, incluyendo build, CSS, secretos y auditoría de dependencias.

Todas las evidencias y ensayos SQL pueden repetirse sin crear registros permanentes.
