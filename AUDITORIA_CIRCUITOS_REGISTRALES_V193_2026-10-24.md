# SACRAMENTUM FINAL · V193 · Asiento registral integral de los cuatro sacramentos

**Fecha:** 24 de octubre de 2026 · **Ruta canónica:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`
**Base:** proyecto Supabase REGISTRO SACRAMENTOS.

## Objetivo y naturaleza de las pruebas
Ejecutar **de verdad en PostgreSQL** los cuatro circuitos parroquiales consecutivos: creación de boleta, asiento de partida con coordenadas de libro/folio/número, cierre y archivado de boleta, registro de auditoría y rechazo de un segundo asiento. No basta con inspeccionar pantallas o hacer tests estáticos.

**Protocolo reproducible:** `scripts/qa-rollback-four-sacrament-seating-v193.sql`, probado directamente en Supabase en dos rondas (segunda posterior a reforzar el control de tipo de libro).

- Se usó la identidad institucional vigente del rol Parroquia, con `SET LOCAL ROLE authenticated` y JWT de prueba simulado mediante `SET LOCAL` (esto NO constituye inicio de sesión real ni prueba de validez de JWT externo).
- Dentro de una única transacción reversible se ajustaron **temporalmente** los cuatro parámetros parroquiales a libro ficticio **9876**, folio 1, número 1, sin modificar su configuración guardada.
- Las cuatro RPC reales `create_pending_baptism`, `create_pending_confirmation`, `create_pending_marriage`, `create_pending_funeral` crearon boletas ficticias diferentes, cada una vinculada a la parroquia autorizada.
- Las RPC `seat_baptism_records`, `seat_confirmation_records`, `seat_pending_marriage` y `seat_funeral_record` asentaron 4 partidas reales **solamente dentro de la transacción**. Se verificaron `book_number`, `folio`, estado seated y asociación parroquial.
- En Matrimonio y Exequias, se comprobó explícitamente `book_type='ordinario'`.
- Las cuatro boletas quedaron `status='seated'` y `reportado IS TRUE`, sin perder la asociación con su partida.
- Un reintento de asiento de cada una de las cuatro boletas fue rechazado por la RPC correspondiente. **4/4 reintentos bloqueados**, sin doble asiento.
- `registry_audit_log` incorporó **4 entradas nuevas `seat`** dentro de la transacción, una por sacramento.
- Después de `ROLLBACK` se confirmó **0 partidas con libro QA 9876** en Bautismos, Confirmaciones, Matrimonios y Exequias. Sin registros QA ni cambios de numeración persistentes.

### Controles cuya funcionalidad registral de backend queda demostrada
- **08.03 · Asiento en libro de Bautismo.**
- **09.04 · Asiento en libro de Confirmación.**
- **10.05 · Asiento y libro de Matrimonio.**
- **11.01 · Inscripción de Exequias.**
- **11.04 · Libro ordinario de Exequias.**

Estos controles se certifican estrictamente en su componente de datos y RPC institucional, con evidencia positiva y negativa reproducible. Su UI no fue recorrida en este ensayo. Los controles de impresión, celebraciones y notas marginales siguen sin aprobar.

## Regresión técnica
- `scripts/test-four-sacrament-seating-v193.mjs` verifica cuatro contratos de cobertura de SQL, rechazos, trazabilidad y rollback; incorporado en `scripts/audit-gate-v90.mjs`.
- Gate V193: **1.481/1.481 pruebas automatizadas** y **30/30** comprobaciones aprobadas, build producción y auditoría de dependencias correctos.
- Esta nueva evidencia tampoco certifica sesiones de navegación reales, simultaneidad de dos transacciones PostgreSQL, recuperación de desastre, firma auténtica ni equivalencia canónica de documentos antiguos.

**Nuevo corte del plan maestro:** 22 controles APROBADO de 325 = **6,8 %**. Los defectos y pendientes de conciliación histórica identificados previamente permanecen abiertos; no se renumeró ni alteró el archivo antiguo.
