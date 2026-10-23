# SACRAMENTUM — V164 · CHAT DIOCESANO, AISLAMIENTO DE CUENTAS Y RLS

Fecha 2026-10-23. Módulo institucional Chat Diocesano (Parroquia, Diócesis y Cancillería).

## Hallazgo
La pantalla CommunicationsPage tenía estado React persistente de conversaciones, mensajes, borradores y suscripción por sala, inicializaba sólo con useEffect([]) y no reiniciaba su subárbol al cambiar de usuario o jurisdicción dentro de la aplicación. Existía riesgo de exposición temporal de información de la cuenta anterior al reutilizar la pantalla en sesiones compartidas.

## Corrección implementada
- Nuevo wrapper CommunicationsPage toma useAuth, exige authId y perfil activo de rol admitido; sin ellos bloquea el montaje del Chat.
- CommunicationsPageSession key basada en authId, perfil, rol, diócesis, parroquia y cancillería; al cambiar cualquiera desmonta todo el subárbol. Se eliminan instantáneamente salas, mensajes, borradores y participantes asociados a la cuenta anterior.
- La suscripción en tiempo real verifica cancelled después de loadMessages y, si termina después del desmontaje, se desuscribe inmediatamente antes de ser utilizada.
- Sin migraciones, sin concesiones de permisos y sin modificación de mensajes existentes.

## Prueba física en Chrome aislado
- scripts/audit-chat-session-browser-v164.mjs ejecutó el componente React auténtico con dos perfiles y dos diócesis completamente ficticios.
- 7/7: perfil A ve sólo su sala y mensaje; cambio B sin A y borrador A; B carga mensajes propios; respuesta lenta A no se reintroduce; logout elimina mensajes y finaliza suscripción; A regresa sin arrastrar contenido B ni borrador anterior.
- Captura PNG real y observaciones en AUDITORIA_EVIDENCIA_CHAT_V164/v164-chat-b-excludes-a.png y AUDITORIA_AISLAMIENTO_CHAT_V164.json.

## Supabase RLS ejecutado en vivo y revertido
- scripts/qa-rollback-chat-role-rls-v164.sql: miembro activo autorizado obtiene sala e historial; una identidad aleatoria autenticada sin perfil no accede a salas/mensajes vía SELECT, no ve conversaciones propias ni puede invocar lectura/envío del chat ajeno.
- Utilizó SET LOCAL ROLE authenticated y manipulación de claims solamente dentro de BEGIN/ROLLBACK. Sin persistencia ficticia ni modificación de datos reales.
- En la BD había dos salas en una sola diócesis; por tanto no es prueba de un miembro real de otra diócesis. Se deja abierta esa validación.

## Calidad y riesgo residual
- 1142/1142 pruebas sintéticas, 28/28 verificaciones de calidad; compila y npm audit no reporta vulnerabilidades.
- 5 funciones SECURITY DEFINER de chat con revisión parcial adicional: inventario 208, funciones authenticated 147, verificadas parcialmente 42, todavía pendientes 105.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":106,"PENDIENTE":209}; 4 controles nuevos pasan de PENDIENTE a EN_PROGRESO y otros controles reciben evidencia. Ninguno pasa a APROBADO.
- Resta verificar chat E2E con cuentas reales, otras diócesis, envío y retiro positivos y concurrencia PostgreSQL simultánea.

**Dictamen:** mitigación del riesgo de retención de chat entre cuentas demostrada en navegador y autorizaciones negativas respaldadas por RLS real. Certificación integral pendiente.
