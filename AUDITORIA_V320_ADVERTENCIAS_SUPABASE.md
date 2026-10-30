# SACRAMENTUM V320 — Auditoría y tratamiento de advertencias de Supabase
**Fecha:** 29 de octubre de 2026 (Colombia)
**Proyecto Supabase:** `foczofcmwampjvlfbsqn`
**Advertencia operativa:** la base aún contiene exclusivamente datos de ensayo; no se autoriza la operación eclesial oficial con estos cambios por sí solos.

## Antes y después (Supabase Advisors)
| Categoría | Antes | Después | Interpretación |
|---|---:|---:|---|
| RLS auth initplan, rendimiento (WARN) | 3 | 0 | Corregidas las expresiones de políticas; ahora `(SELECT auth.uid())` evita evaluación repetida |
| FK sin índice (INFO) | 35 | 0 | Añadidos 35 índices sin eliminar índices previos |
| Índices marcados como sin uso (INFO) | 49 | 83 | Aumentaron al crear índices nuevos que aún no registran lecturas. Es un indicador histórico, NO una instrucción de eliminarlos |
| Tablas RLS sin políticas (INFO) | 17 | 17 | Comprobado que ninguna tiene privilegio `SELECT` para `anon` ni `authenticated`; la ausencia de políticas mantiene cerrado el acceso directo |
| `SECURITY DEFINER` ejecutable por `authenticated` (WARN) | 173 | 173 | Son RPC privilegiados que requieren revisión *por función*; no se revocaron indiscriminadamente, para no romper altas, asientos, decretos, documentos y flujos |
| Protección frente a contraseñas filtradas en Auth (WARN) | 1 | 1 | Se activa en configuración de Supabase Auth (requiere plan Pro o superior). No existe en el conector disponible una acción para cambiar esa configuración |

## Cambios realizados
1. `supabase/deployment/v320_rls_policy_security_and_initplan.sql`: optimización de `pending_tokens_insert_owner`, `decretos_select_scope` y la regla restrictiva de notificaciones.
2. `supabase/deployment/v320b_restrictive_notification_policy_fix.sql`: guardia de decretos **RESTRICTIVE**, neutra para avisos no decretales. La política permisiva sigue autorizando avisos generales solo por su jurisdicción. La combinación garantiza que el obispo nunca vea decretos parroquiales y que las notificaciones generales continúen funcionando.
3. `supabase/deployment/v320c_foreign_key_indexes.sql`: 35 índices que cubren las claves foráneas señaladas, sin borrar información ni ampliar derechos.

## Verificación directa en PostgreSQL
Archivo: `scripts/qa-rollback-notifications-rls-v320.sql`.
Se crearon cuatro notificaciones ficticias (dos decretos y dos avisos generales) y una segunda parroquia ficticia con su usuario. Tras activar el rol PostgreSQL `authenticated`:
- Párroco A: ve solo su decreto y aviso general.
- Párroco B: ve solo los suyos.
- Cancillería: ve ambas notificaciones de decreto y los avisos generales de la misma diócesis.
- Diócesis: no ve los decretos parroquiales, pero sí los dos avisos generales.
Todos los registros se revirtieron con `ROLLBACK`. Se comprobó también el rechazo de inserción directa de decreto desde el usuario diocesano.

## Revisión del aviso masivo de funciones privilegiadas
Al momento de la auditoría existían **256 funciones SECURITY DEFINER** en `public`: **0** ejecutables por `anon` y **173** ejecutables por `authenticated`. La inspección automática de texto de código encontró referencias directas a identidad/rol en **166 de estas 173 funciones**; las 7 restantes invocan otras funciones de autorización o procedimientos internos (`get_chat_room_messages*`, `register_historical_baptism`, `reverse_*_with_reason`, etc.). Este examen **no prueba de manera suficiente la seguridad de las 173**; la habilitación oficial aún requiere pruebas de autorización por endpoint y contrato, especialmente para importación histórica y RPC con permisos de Cancillería.

No se recomienda revocar en bloque `EXECUTE` a `authenticated` ni cambiar `SECURITY DEFINER` a `INVOKER` por el mero aviso: esos cambios pueden invalidar RLS de las operaciones legítimas.

## Pendiente de intervención en Dashboard
En Supabase Dashboard > Authentication > Settings > Password security, activar **Leaked Password Protection** si el plan Supabase lo permite. Guardar la configuración y volver a ejecutar Security Advisor. Referencia: https://supabase.com/docs/guides/auth/password-security.

## Pruebas de calidad y límites
- `scripts/test-v320-supabase-advisors.mjs`: seis pruebas de regresión del contrato RLS/índices y de inclusión en CI.
- Auditoría general de SACRAMENTUM: **30/30 verificaciones aprobadas**, con compilación de producción y comprobaciones de dependencias.
- Las advertencias INFO restantes no equivalen necesariamente a un riesgo. La configuración de Auth y los 173 avisos de funciones de seguridad no están eliminados ni deben declararse «resueltos» sin verificación de sus riesgos particulares.

**Conclusión:** la mejora de rendimiento y la privacidad entre roles ya fueron corregidas y comprobadas. NO se debe afirmar «cero advertencias» mientras permanezcan avisos de Auth y funciones privilegiadas.
