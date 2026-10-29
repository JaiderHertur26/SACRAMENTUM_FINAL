# SACRAMENTUM — V295 — Decreto corregido y vista parroquial

Fecha: 2026-10-29 UTC. De referencia: **Decreto 002.pdf** del usuario.

## Diagnóstico con datos reales (sin modificar)
- El Decreto 002 corresponde al registro ficticio `f5119c0a-1419-477f-a1ad-75c8abecc55c`.
- `payload.targetName`: **THIAGO JUNIOR SIERRA REYES** (título antiguo).
- `payload.newPartidaDraft.nombres`: **THIAGO JOSÉ** (nombre efectivamente corregido).
- `payload.draftDetails.originalPartida.nombres`: **THIAGO JUNIOR** (historia que debe mantenerse).
- El código de impresión `buildRecord` combinaba primero datos corregidos y finalmente datos importados, sobrescribiendo las correcciones. El encabezado también daba prioridad a `payload.targetName`.
- Estado actual: `seatStatus=awaiting_parish`, sin Libro/Folio/Número nuevos.

## Corrección implementada
1. `buildRecord` ahora da prioridad a `payload.newPartidaDraft` (la nueva memoria corregida), por encima del registro histórico, datos importados, cambios y metadatos. Todos los campos compartidos (nombres, apellidos, padres, fechas, lugar, sexo, tipo de unión, ministro, padrinos y abuelos) reciben la misma prioridad.
2. El encabezado calcula el nombre a partir de la propuesta nueva y usa el titular anterior únicamente como respaldo cuando no hay propuesta de identidad.
3. Se retiró el sello de Cancillería y se centraron nombre y cargo del Canciller/Vicecanciller en el formato PDF y en las tres plantillas alternativas. Se mantuvo `CAL-ODC-022`, `002`, sin modificación a la identidad original.
4. La página de **Leer decreto** de Parroquia conserva arriba `ParishDecreeSeatPanelV280`; debajo sustituye los paneles extensos de metadatos por un **visor del mismo HTML documental tamaño carta**, mediante iframe con `sandbox` sin scripts de impresión. La impresión abre el mismo generador con impresión activada una vez asentado el decreto.
5. Se eliminó la repetición visual «Decreto Decreto 002». Todas las notas, campos históricos y auditores permanecen en el registro, aunque ya no se enumeran bajo la vista del decreto.

## Validación
- 5/5 pruebas V295 de prioridad de campos, encabezado corregido, no alteración histórica, firma, ausencia de sello, vista y lógica de impresión.
- Chrome generó un PDF de **una página**: `DECRETO_002_CARTA_PAGES=1`, 136.509 bytes, con el documento ficticio representativo del 002.
- 30/30 auditoría maestra (incluidos los regresivos V14/V30/V280 actualizados para la vista documental).
- El cambio es exclusivamente frontend y de pruebas; no hace UPDATE sobre decretos ni partidas.
