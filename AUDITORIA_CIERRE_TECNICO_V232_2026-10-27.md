# SACRAMENTUM FINAL — V232 · AUTORIZACIÓN DE 152 FUNCIONES PRIVILEGIADAS
**Fecha:** 27 de octubre de 2026. **Base:** Supabase QA `foczofcmwampjvlfbsqn` exclusivamente ficticia.

## Auditoría real del catálogo privilegiado
Se consultó directamente `pg_proc` mediante SQL de solo lectura y una cuenta privilegiada. Fueron enumeradas las **152 funciones SECURITY DEFINER accesibles por `authenticated`**, guardando exclusivamente nombre, firma, dueño, referencias de controles, indicadores de modificación y MD5 del cuerpo (para detectar cambios, NO como firma digital ni revisión manual). Sus fuentes están en:
- `AUDITORIA_RPC_152_FUENTE_LIVE_V232.json`: antes del cambio;
- `AUDITORIA_RPC_152_POST_LIVE_V232.json`: después del cambio.

Comparación verificada:
- Funciones accesibles: **152 → 152**.
- Funciones que consultan directamente `auth.uid()`: **134 → 137**.
- Sin llamada directa a `auth.uid()`: **18 → 15**. Muchas delegan los controles, por lo cual esa clasificación NO demuestra vulnerabilidad.
- Sin llamada directa ni referencia a un conjunto limitado de validadores comunes: **14 → 11**.
- 101 funciones contienen posibles operaciones DML en el cuerpo; el escaneo textual puede detectar también texto no ejecutable.
- Cero referencias a metadatos de usuario editables, cero candidatos de SQL dinámico `EXECUTE` y cero funciones con nombre `_internal` expuestas directamente a autenticados. Son hallazgos de búsqueda textual, no un certificado exhaustivo.

## Corrección de seguridad REAL en QA
Se aplicó la migración registrada por Supabase **`20261027125848_harden_chat_actor_guard_v232.sql`**, que preserva todas las funciones y ACL existentes pero agrega una verificación explícita `auth.uid() IS NOT NULL`, rechazando sesiones no autenticadas con código PostgreSQL **42501**, al comienzo de:
1. `public.send_chat_message`
2. `public.mark_chat_room_read`
3. `public.withdraw_chat_message`

No se suprimió la autorización original `current_chat_profile_id`, la membresía y jurisdicción de `can_access_chat_room`, ni la comprobación de propiedad del mensaje y los quince minutos para retirarlo.

La migración primero fue ensayada en una transacción revertida. Tras aplicarla realmente, un usuario de prueba con rol `authenticated` intentó **enviar un mensaje a una sala de otra diócesis, marcarla como leída y retirar un mensaje ajeno** dentro de una transacción; las tres operaciones fueron rechazadas y el ensayo terminó con ROLLBACK. Se verificó la presencia de 12 posibles pares cuenta/sala ajenos y que solo se modificaron las tres fuentes esperadas.

## Regresiones funcionales posteriores
- **8/8** sesiones reales GoTrue autenticadas.
- **24/24** intentos de creación de borradores sacramentales fuera de jurisdicción denegados con `42501`.
- **4/4** rutas reales de Parroquia, Diócesis, Cancillería y Administrador General en el navegador React.
- Los conteos permanecieron: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, una Exequia, 12 usuarios Auth, 1 mensaje de chat, 4 salas y 16 membresías. No hubo persistencia de mensajes de prueba ni modificación de partidas.
- La fuente de código de las **149 funciones restantes** conserva la huella detectada antes del cambio.

## Historial de instalación limpia coherente
La nueva migración aumenta el inventario a **159 archivos SQL**. Se renovaron los hashes y el sello de procedencia de V231 para incluir V232. Se mantienen **14 migraciones con 45 instrucciones DML directas**, de las cuales 39 requieren exclusión o tratamiento y seis son candidatas a plantillas/catálogos aún sin aprobar. **No se cambió ninguna migración antigua aplicada en QA**.

## No se considera concluido
El inventario automático es apenas triage: **ninguna de las 152 funciones queda marcada como aprobada en revisión semántica** por la sola presencia de `auth.uid()`. Quedan pendientes la inspección firma por firma y pruebas de permisos del catálogo completo, las ACL futuras del propietario `supabase_admin`, SMTP externo, restauración efectiva de respaldo y una instalación oficial nueva, totalmente vacía y separada de QA.

Todos los datos presentes son de prueba y no se copiarán a producción. La publicación Vercel continúa restringida al modo ficticio; un intento de certificar esta misma base como oficial permanece prohibido.
