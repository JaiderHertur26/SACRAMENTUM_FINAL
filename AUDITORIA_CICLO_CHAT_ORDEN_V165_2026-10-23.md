# SACRAMENTUM — V165 · Ciclo completo del Chat Diocesano

Fecha 23 de octubre de 2026. Enlace: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL

## Hallazgo confirmado
- Dentro de PostgreSQL, now() es constante durante una transacción. La función send_chat_message utilizaba la hora por defecto now(); si se enviaban dos mensajes dentro de una transacción, podían compartir created_at.
- mark_chat_room_read elegía el último por ORDER BY created_at DESC sin segundo criterio. Una prueba real con 2 envíos válidos dentro de una transacción provocó que el recibo señalara otro mensaje. El ensayo abortó y revirtió los datos.

## Corrección aplicada
- Migración efectiva Supabase: 20261023142209_chat_message_order_consistency_v165.sql.
- chat_messages.created_at tiene ahora DEFAULT clock_timestamp(); send_chat_message fija explícitamente la fecha de envío mediante clock_timestamp() para cada inserción.
- mark_chat_room_read ordena por created_at DESC,id DESC; get_chat_room_messages usa el mismo desempate y agrega de antiguo a reciente por created_at,id. list_my_chat_rooms también desempata el mensaje de vista previa.
- No hay UPDATE de mensajes históricos, DROP, ni cambio de privilegios. Las cuatro funciones conservan SECURITY DEFINER y search_path.

## Prueba funcional positiva y negativa en Supabase
- scripts/qa-rollback-chat-full-lifecycle-v165.sql: usuario real activo de Parroquia emite mensaje y respuesta; usuario de Cancillería responde y retira su propio mensaje; Diócesis (usuario real activo, pero excluido de la sala ficticia) no puede ver, escribir, marcar como leído ni retirar.
- 7 verificaciones positivas y 9 operaciones denegadas (vacío, >4000, referencia errónea, retiro ajeno/duplicado, acceso/operación de no miembro).
- Reproducción complementaria de timestamps históricos idénticos: se fija fecha igual a los tres mensajes ficticios; cursor, historial y resumen de sala concuerdan en ID ordenado.
- La prueba se ejecutó tras aplicar la migración, bajo SET LOCAL ROLE authenticated y con BEGIN/ROLLBACK. Cero salas y mensajes de QA-V165 residuales.

## Calidad, alcance y limitaciones
- 1157/1157 pruebas sintéticas, 28/28 verificaciones generales. Compilación y auditorías de dependencias correctas sin vulnerabilidades reportadas.
- Registro RPC: 208 SECURITY DEFINER, 147 ejecutables autenticadas, 44 con evidencia parcial, 103 pendientes de revisión manual.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":110,"PENDIENTE":205}: cuatro controles de Chat avanzan a EN_PROGRESO, ninguno se certifica integralmente.
- Paginación total de chat aún no certificada: la firma actual p_before por timestamp puede omitir mensajes antiguos si varias filas históricas comparten exactamente la misma fecha; separar nuevo cursor compuesto en siguiente etapa.
- Sesiones reales de diferentes diócesis y dos conexiones PostgreSQL realmente simultáneas siguen pendientes.

**Dictamen:** defecto de orden y lectura corregido y verificado, ciclo de mensajería probado reversiblemente, certificación integral permanece abierta.
