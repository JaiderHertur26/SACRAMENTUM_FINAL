# V270 — Sucesión atómica de libros físicos ordinarios

**Implementada en rama, no desplegada en Supabase; uso exclusivo de pruebas con PostgreSQL aislado antes de apertura oficial.**

El nuevo procedimiento `public.open_next_official_book_v270` permite cerrar un Libro **ya utilizado** y abrir su sucesor en una **sola transacción**, con código del libro, folio inicial, número inicial y capacidad introducidos por el usuario. No toma ninguna coordenada de Parámetros, no borra ni modifica las partidas del tomo anterior y no se puede volver a asentar en un Libro cerrado. Mantiene `active_seats`, `seat_events` y todas las partidas físicas del libro previo.

La memoria privada V252 incorpora `closed_at`, `closed_by_auth`, `close_evidence_ref`, `predecessor_book_id` e índice único de predecesor. El cierre no se puede modificar una vez confirmado. La RPC V270 valida sesión/parroquia, boleta nueva pendiente con certificación, cotejo de la última partida física de su libro y versión de memoria actual, referencia documental de cierre, código nuevo nunca utilizado y ausencia de otro libro ordinario abierto. El servidor registra dos eventos institucionales: cierre y apertura sucesora, en la misma transacción del cambio. Retorno idempotente solo si nadie ha asentado todavía en el sucesor.

La vía V267 de **primer** libro ahora rechaza abrir un segundo Libro por error. La consulta V264 no ofrece como seleccionables los libros cerrados y comunica `activeCount`; V263/V253 prohíben asentar en memorias `closed_at IS NOT NULL`. El componente `NextOfficialBookV270.jsx` se integra en `LedgerSeatPanelV264.jsx` y por esa vía queda disponible en las cuatro pantallas sacramentales. `src/services/ledgerSeatV264.js` comprueba que la respuesta del servidor coincida exactamente con los datos solicitados.

La transacción V267 de apertura oficial exige la firma RPC V270 y habilita su ejecución únicamente en el corte coordinado; no se otorga permiso independiente antes de la activación oficial.

**Límites expresos:** este mecanismo es para Libro Ordinario **tras agotar un tomo auténtico**; los suplementos por decreto requieren autorización con control de Cancillería distinto, y no se habilitan mediante el cierre ordinario. Las 8.393 partidas ficticias de la instancia actual permanecen intactas; no se hizo reset, merge ni deploy.
