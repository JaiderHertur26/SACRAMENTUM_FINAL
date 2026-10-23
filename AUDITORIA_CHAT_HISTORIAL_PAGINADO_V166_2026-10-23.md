# SACRAMENTUM — V166 · Paginación íntegra del historial del Chat Diocesano

Fecha 2026-10-23. GitHub issue #9.

## Defecto preexistente
- La RPC get_chat_room_messages usaba cursor p_before como fecha exclusiva; si muchos mensajes históricos tenían la misma fecha y se cortaba la página por el medio, se omitía el resto de esos mensajes.
- Se preserva RPC anterior para compatibilidad de clientes históricos. El frontend actual usa la nueva RPC V166.

## Corrección efectiva
- Migration Supabase: 20261023144508_chat_history_keyset_v166.sql. Nueva RPC get_chat_room_messages_v166 recibe p_before_created_at + p_before_id.
- Consulta antigua por (created_at,id) < (fecha,id) con ORDER BY created_at DESC,id DESC, tamaño 1–100. La salida ordena de antiguo a reciente. Índice (room_id,created_at DESC,id DESC).
- SECURITY DEFINER con search_path public y comprobación obligatoria can_access_chat_room. Sólo autenticados tienen EXECUTE; anon no. No hay permiso directo sobre tabla para nuevos roles.
- ChatService actualizado para pasar cursor doble. CommunicationsPage incluye Cargar 80 mensajes anteriores, fusiona por UUID sin duplicados, conserva el historial al recibir mensajes recientes y desactiva auto-scroll al cargar páginas antiguas.
- El selector de sala utiliza versión de consulta y roomId para descartar resultados tardíos de otra sala, y en cambio de usuario el subárbol se desmonta (v164).

## Evidencia real y visual
- scripts/qa-rollback-chat-keyset-complete-v166.sql ejecutado sobre Supabase instalado: 305 mensajes de exactamente 2012-01-01T10:00:00Z más 7 recientes. 312 únicos recuperados: 80+80+80+72, seguida de página vacía.
- Seis operaciones malformadas/ajenas denegadas: page >100, 0, cursor incompleto por ambos lados y dos perfiles activos ajenos a la sala.
- Ensayo siempre BEGIN/ROLLBACK y comprobación independiente: 0 salas y 0 mensajes QA-V166 remanentes, índice presente, authenticated EXECUTE true, anon false.
- scripts/audit-chat-history-browser-v166.mjs utilizó Chat React verdadero en Chrome con mocks estrictamente locales: 6/6 pasos, 312/312, sin duplicados, sin overflow y eliminación de historia de la primera cuenta al cambiar a otra. Captura AUDITORIA_EVIDENCIA_CHAT_V166/v166-chat-history-312.png.
- Reejecución de regresión V164: 7/7 cambios de identidad/desuscripciones sobre Chat React con mocks, sin fugas.

## Calidad y limitaciones
- 1176/1176 sintéticas, 28/28 controles gate; npm audits y build sin hallazgos.
- Inventario 209 privileged functions, 148 authenticated, 45 partially reviewed y 103 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":111,"PENDIENTE":204}; 16 controles con nuevas evidencias y 19.09 pasa de pendiente a en progreso sin certificación completa.
- No se han probado aún sesiones reales de dos diócesis ni transacciones simultáneas PostgreSQL con locks y barrera. El paso de revisión parcial a APROBADO exige ambas dimensiones.

**Dictamen:** bug de paginación por timestamps iguales corregido y comprobado en Supabase y Chrome aislado; auditoría integral permanece abierta.
