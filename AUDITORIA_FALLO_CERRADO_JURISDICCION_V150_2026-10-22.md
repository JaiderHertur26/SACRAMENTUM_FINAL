# SACRAMENTUM — V150: AUTORIZACIÓN PARROQUIAL CON FALSE EXPLÍCITO

## Hallazgo reproducido
- can_access_parish devolvía NULL al autenticado ficticio sin user_profiles. IF NOT NULL dentro de funciones SECURITY DEFINER no ejecutaba su bloqueo. Se demostró que register_registry_print avanzaba hasta el error «Bautismo no encontrado» en vez de rechazar jurisdicción.
- Este resultado identifica una falla de autorización lógica para identidades sin perfil; no se comprobó que un atacante externo hubiera explotado la falla.

## Corrección aplicada
- CREATE OR REPLACE de public.can_access_parish con COALESCE(...,FALSE), auth.uid() IS NOT NULL y target_parish_id IS NOT NULL.
- Migración 20261022194003_fail_closed_can_access_parish_v150.sql, identificador verificado en supabase_migrations.schema_migrations.
- Conservados signature, SECURITY DEFINER, búsqueda y alcance admin_general/parish/diocese/chancery. No hubo permisos GRANT nuevos ni UPDATE de datos.

## Ensayos reales reversibles
- Baseline previa: actor authenticated ficticio y sin perfil producía NULL; impresión llegaba a «Bautismo no encontrado».
- Dry-run CREATE OR REPLACE en BEGIN/ROLLBACK: falsa identidad obtiene FALSE y se rechaza por jurisdicción.
- Tras migración real: rechazo de print RPC y corrección de Bautismo; cinco aserciones de actor parroquial legítimo, otra parroquia, Cancillería, admin general y actor sin perfil, con ROLLBACK.
- SELECT de 9 tablas sensibles con actor ficticio no devolvió filas. No se crearon partidas o decretos QA persistentes.
- La función can_access_chat_room usa EXISTS (FALSE en ausencia) y can_manage_legacy_import tiene ELSE RETURN FALSE; en estas se descarta por ahora la misma causa directa.

## Calidad e inventario
- scripts/test-parish-authorization-fail-closed-v150.mjs: 15 nuevas pruebas; 873/873 sintéticas totales; 28/28 verificadores.
- AUDITORIA_RPC_PRIVILEGIADAS_V150.json: 22 funciones con evidencia parcial, 114 pendientes del subconjunto catalogado V148.
- La consulta en tiempo real contó 200 SECURITY DEFINER de varios esquemas de usuario (191 public); el listado V148 de 136 debe conciliarse y no se presenta como inventario exhaustivo de seguridad.
- Plan maestro: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. Evidencia agregada en 17 controles, sin reclasificar los pendientes.

## Limitaciones verificadas
- El intento de concurrencia con dos consultas de la API administrativa fue serializado por el servicio; NO prueba bloqueo simultáneo de dos conexiones auténticas.
- El backend V150 quedó corregido; el frontend V149 no se desplegó. No se auditó impresión física ni interfaz autenticada completa.
- La revisión de 114 RPC privilegiadas restantes y posibles condiciones NULL de otras funciones sigue en curso.

**Dictamen:** falla de permisos NULL reproducida, corregida y reensayada en backend real sin persistir datos ficticios. No equivale a auditoría terminada.
