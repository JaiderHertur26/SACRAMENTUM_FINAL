# SACRAMENTUM V291 — Buscador escalable de partidas celebradas

Fecha: 2026-10-28/29 · módulo de notificaciones de Matrimonio y Confirmación.

## Problema corregido
El circuito V290 usaba `loadSacramentalCaseContextV277` con `.limit(300)` para cada sacramento y presentaba un selector HTML largo. En una parroquia con miles de partidas, la búsqueda era engorrosa y los asientos fuera de los primeros 300 eran invisibles.

## Implementación
- Se eliminó la precarga de 300 Matrimonios y 300 Confirmaciones del contexto de V277. El contexto solo carga parroquias autorizadas para los destinatarios.
- `CelebratedSacramentSearchV291.jsx` sustituye el selector de partidas celebradas. Busca por nombres y apellidos, permite criterios opcionales Libro/Folio/Número/fecha, muestra hasta 15 registros por página y ofrece Anterior/Siguiente.
- Las peticiones usan debounce de 300ms, descartan respuestas obsoletas, y la selección guarda UUID y snapshot del asiento para mantener la identidad original; al cambiar sacramento o filtros se limpia la selección.
- `searchCelebratedSacramentalRecordsV291` llama una función SQL paginada, sin `parishId` suministrado por el cliente. Muestra Matrimonio (nombre de ambos contrayentes, también registros importados con `nombr1/nombr2`) y Confirmación.
- RPC `search_celebrated_sacramental_records_v291`: SECURITY DEFINER con `search_path=''`, auth.uid obligatorio, identidad activa `role='parish'`, parroquia/diócesis coherentes y operativas. Excluye anulaciones, registros sin coordenadas, celebraciones futuras o identidades vacías, y no otorga EXECUTE a anon/PUBLIC.
- Compara coordenadas normalizando ceros iniciales y permite libros alfanuméricos (`0001A`), sin alterar ninguna secuencia.
- Ruta y formularios previos de Cancillería no modificados; `App.jsx` sin cambios.

## Evidencia
- Supabase V291 instalada con versión `20261029031120`.
- Prueba de SQL real en transacción `BEGIN/ROLLBACK` con rol `authenticated`: 3 Confirmaciones para un apellido buscado, 1 coincidencia exacta de Libro/Folio/Número, 2 páginas distintas limitadas a 2 y sin resultados para búsqueda inexistente. Matrimonio por nombre igualmente verificado.
- Privilegios: `anon` EXECUTE falso; `authenticated` EXECUTE verdadero.
- 8/8 pruebas V291 de diseño de búsqueda, seguridad, paginación e integración.
- Auditoría general 30/30 y compilación Vite correcta.
- Conteos de datos previos conservados (1261 Matrimonios, 2091 Confirmaciones).
- SQL certificado con SHA-256 e incorporado al inventario de 192 migraciones.
