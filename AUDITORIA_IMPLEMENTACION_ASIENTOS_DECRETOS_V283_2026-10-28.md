# SACRAMENTUM — Cierre técnico V279–V283 · 28 octubre 2026
## Requisitos convertidos en código y reglas reales

### Parámetros
- El backend rechaza INSERT/UPDATE/DELETE en `public.parish_parameters` para el rol `authenticated`; SELECT permanece.
- Los cuatro RPC antiguos `save_baptism_parameters`, `save_confirmation_parameters`, `save_marriage_parameters`, `save_funeral_parameters` ya no son ejecutables por sesiones de cliente.
- `update_parish_boleta_counter_v256` sí se puede ejecutar por `authenticated`, comprueba identidad de parroquia y aplica comparación de versión actual, avance positivo y auditoría.

### Asientos de registros nuevos
- Se reparó una dependencia del motor real V263: ahora usa `sacramentum_ledger.append_verified_batch_v281`, derivada del motor probado V253, invocable solo internamente.
- El backend ordena por fecha de celebración, número de boleta e ID, y asigna los siguientes Folio y Número del libro atómicamente.
- Soporta Libro alfanumérico (`0001A`) y numérico (`0001`), capacidad fija y control de versión. Las configuraciones con asientos se protegen contra cambios.
- Prueba real en Supabase bajo `BEGIN/ROLLBACK`: tres Bautismos, 2 partidas/folio; dos en Folio 1 y la tercera en Folio 2. No quedaron partidas de prueba añadidas.

### Decretos nuevos
- Cancillería emite `issue_chancery_decree_v280` SIN Libro/Folio/Número.
- Diócesis aprueba expresamente conceptos supletorios para Corrección o Reposición `approve_decree_concept_for_new_seat_v282`.
- La parroquia recibe una notificación oficial; solo tras leerla puede sentar desde la vista del decreto y confirmar Libro/Folio/Número/capacidad.
- El servidor serializa por parroquia y fuerza fecha del decreto ASC, luego recepción ASC, luego ID ASC. No permite saltar el más antiguo.
- Corrección: asiento nuevo + anulación de partida original + nota marginal en una única transacción; Reposición: asiento nuevo sin anulación.
- El libro conserva capacidad y regla de reinicio; al reusar libro se comprueban versión, Folio y Número esperados.
- La parroquia conserva decreto, nueva partida y cierre de notificación; Cancillería recibe una constancia de retorno con Libro, Folio y Número.
- Todas las operaciones dejan auditoría. El procedimiento impide procesar decretos históricos como nuevos.

### Pruebas y archivos
- Pruebas transaccionales **reales** de PostgreSQL con `ROLLBACK`: Bautismo en lote y salto de folio; decreto Corrección sin asignación prematura, asiento y anulación atómica; rechazo de decreto más reciente antes del antiguo; rechazo de cambio de capacidad (2 a 3) y aceptación con capacidad correcta; devolución a Cancillería. No quedaron datos QA nuevos.
- Pruebas sintéticas V280: 10/10. Auditoría global del código: 30/30.
- Versiones exactas de migración aplicadas en Supabase: V279, V281, V280, V280 asiento, V280B, V282 y V283. Las copias SQL locales están en `supabase/migrations` con los timestamps remotos.
- `src/App.jsx` no se ha cambiado para preservar la evidencia de autenticación previa; se integró el flujo en rutas ya protegidas.
- La aplicación aún tiene datos sacramentales históricos ficticios y el modo de **apertura registral oficial** no ha sido ejecutado: requiere respaldo externo restaurable y corte coordinado. Esto NO invalida la implementación y pruebas del circuito de decretos, pero impide declarar uso oficial de libros con datos mezclados.
