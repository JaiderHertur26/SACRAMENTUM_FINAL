# SACRAMENTUM FINAL · V261 · Contrato final de foliación y reversión física ensayada

**28 octubre 2026. Rama de desarrollo; NO se aplicó ningún cambio en Supabase.**

## Problema resuelto en el motor y los contratos de ensayo
La V252 asumía que el número de partida siempre crecía a través de los folios. Se agregó `restartNumberPerFolio` (por defecto **false**) al dominio JavaScript y `restart_partida_each_folio` (por defecto **false**) a la memoria privada V252, para cubrir el caso canónico de partida que reinicia al cambiar de folio.

- Modo continuo: Libro `0001A`, primer folio 8, primera partida 50, capacidad 2: `0008/0050`, `0008/0051`, `0009/0052`, `0009/0053`, `0010/0054`.
- Modo reinicio: mismo libro/capacidad: `0008/0050`, `0008/0051`, `0009/0001`, `0009/0002`, `0010/0001`.
- La unicidad de la memoria privada se hizo `(book_id,folio,partida)`: dos partidas iguales en folios distintos ahora son correctas; en el mismo folio siguen prohibidas.
- La política de configuración impide cambiar la modalidad una vez haya asientos. La reversión JavaScript valida folio y número y solo permite el **tramo final**; conserva historia.
- El kernel SQL privado V253, la integración física QA V259 y sus verificaciones de puntero comparten el mismo cálculo, sin depender de números de partidas como si siempre fueran ordinales globales.
- El recibo QA de un asiento ya revertido no puede mostrarse como un éxito activo tras repetirse la operación de origen.

## Reversión física atómica en PostgreSQL ficticio
`scripts/qa-v261-physical-tail-reversal.sql` es exclusivamente un módulo privado de pruebas que une el kernel de reversión V253, eliminación física ficticia, devolución de la boleta a `pending` y registro en el libro de eventos inmutable, **en la misma transacción**. Verifica previamente vínculo único del registro, libro, coordenadas y estado de la boleta. La falta de autorización/motivo o los asientos intermedios se rechazan. Si un documento externo bloquea la eliminación por clave foránea, la operación revierte íntegra, incluida la memoria y el evento.

**Advertencia:** la eliminación física de una partida real no queda autorizada automáticamente por un ensayo. Los efectos jurídicos de eliminación, notas marginales, decretos, documentos, auditorías y dependencias deben validarse sobre las cuatro estructuras reales. La mejor política institucional puede ser invalidación controlada, no eliminación; no habilitar borrado indiscriminado de históricos.

## Comprobación de la instancia actual, solo lectura
En `public.parish_parameters`, las **6** configuraciones actuales tienen `ordinarioRestartNumber` o equivalente **false** para los cuatro sacramentos. Por tanto, esta V261 preserva el modo existente predeterminado y no cambia su interpretación histórica. El inventario de 8393 partidas y 11 ámbitos con discontinuidades no fue modificado.

## Pruebas
`scripts/test-restarting-folio-v261.mjs` comprueba ambas modalidades, transición inicial con partida distinta de uno, rechazo de reversión intermedia, reversión de tramo final, inmovilidad de configuración y cálculo SQL/JS. `scripts/ci-restarting-folio-v261.sh` usa exclusivamente PostgreSQL 16 descartable para asentar un lote real de cinco boletas ficticias, revertir el último asiento, forzar un fallo de reversión por documento externo y demostrar que TODO el cambio revierte; después realiza un nuevo asiento en el puntero correcto. Integrado en GitHub Actions y auditoría de calidad.

## Requisito previo a activación
Persisten como trabajo distinto: conciliar los 22 ámbitos con las fuentes físicas (11 requieren revisión de números); adaptar cuatro **RPC reales** de asiento con reglas especializadas y acceso legítimo; sustituir la configuración cliente a la nueva memoria; y ejecutar corte atómico de V252–V261 con respaldo, test de restauración y control institucional. El motor y sus pruebas no equivalen a una instalación oficial.

**No merge, no despliegue, sin escrituras a Supabase.**
