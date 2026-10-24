# SACRAMENTUM FINAL — V191 · Seguridad delegada de Cancillería

**Fecha:** 24 de octubre de 2026, Colombia.
**Proyecto local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Supabase:** proyecto REGISTRO SACRAMENTOS.

## Fallo real reproducido antes de corregir
La función SECURITY DEFINER `public.sacramentum_assert_chancery_for_parish(uuid)`, invocada por varios RPC de Bautismo/Confirmación, tenía estas condiciones permisivas:

- `coalesce(is_active,true)=true` → trataba `is_active=NULL` como activo.
- `coalesce(status,'active') not in ('blocked','disabled','inactive')` → trataba `status=NULL`, `SUSPENDED`, `PENDING` y estados no bloqueados explícitamente como admisibles.
- Bastaba `chancery_id IS NOT NULL`; no verificaba que `chancelleries.id` correspondiera a la diócesis institucional del usuario.

El ensayo antes de la migración confirmó en PostgreSQL **dos autorizaciones incorrectas**: `NULL_STATUS` y `NULL_ACTIVE` fueron aceptadas por el auxiliar. El ensayo modificó temporalmente el perfil en una transacción con `BEGIN/ROLLBACK`, sin persistir cambios.

## Corrección aplicada en Supabase
**Migración remota:** `20261024203848_chancery_delegated_auth_fail_closed_v191`.

- Sólo se admite `role='chancery'`, `is_active IS TRUE`, `status='ACTIVE'` (sin distinción de mayúsculas), `diocese_id IS NOT NULL`.
- Se exige correspondencia real entre `user_profiles.chancery_id` y `chancelleries.id`, y entre sus respectivas diócesis.
- La parroquia solicitada debe pertenecer a la misma diócesis.
- `SECURITY DEFINER` se mantiene con `search_path` vacío y nombres de tablas cualificados.
- Se utilizó `CREATE OR REPLACE FUNCTION`; no se concedieron nuevos permisos ni se modificó el esquema o los expedientes.

## Ensayos posteriores
`scripts/qa-rollback-chancery-delegation-v191.sql` ejecutado contra Supabase, con actor de Cancillería real pero cambios de perfil **temporales y revertidos**:

- 1 llamada legítima a la autorización de Cancillería: **permitida**.
- **24/24 operaciones rechazadas**: 6 RPC jurídicas (correcciones, reposiciones y reversiones de Bautismo/Confirmación) × 4 estados prohibidos (NULL_STATUS, SUSPENDED, NULL_ACTIVE, FALSE_ACTIVE).
- Además se ensayaron directamente 8 estados/cambios de contexto prohibidos dentro de la validación temporal previa a la migración; la función revisada los rechazó, incluida la ausencia de `chancery_id`.
- El motor restauró el estado del perfil tras `ROLLBACK`. La consulta posterior mostró una Cancillería activa existente y cero perfiles incompletos en el rol.
- La prueba **NO** representa sesiones JWT independientes ni simulación de diócesis ajenas. El catálogo observado no ofreció una segunda parroquia diocesana distinta para comprobar ese último caso y, por tanto, no se contabiliza como superado.

## Inventario auxiliar de seguridad
Los 8 RPC inicialmente marcados por no contener literalmente `auth.uid()` en el cuerpo delegan control en auxiliares:
1–4. Corrección y reposición de Bautismo/Confirmación → `sacramentum_assert_chancery_for_parish`.
5–6. Reversiones de corrección y reposición → mismo auxiliar, luego RPC interna sin EXECUTE directo de autenticados.
7. `register_historical_baptism` → auxiliar interno exige parroquia titular ACTIVE; interno no ejecutable directamente por autenticados.
8. `count_unread_chat_messages` → `current_chat_profile_id` exige usuario activo. Se requieren pruebas funcionales separadas en ambos módulos.

**El acceso directo de `authenticated` a los auxiliares internos relevantes sigue revocado**, confirmado mediante `has_function_privilege`. Tampoco se añadió acceso `anon`.

## Calidad y limitaciones
Las migraciones V190 y V191 quedaron escritas en `supabase/migrations` para mantener trazabilidad con Supabase.
Se incorporaron pruebas de contrato `scripts/test-chancery-delegation-v191.mjs` al gate del proyecto.

El plan maestro mantiene **15/325 controles APROBADO (4,6%)**. El control P0 `06.07` gana evidencia pero sigue EN_PROGRESO por no cubrir aún todas las funciones privilegiadas con sesiones JWT reales. Concurrencia intersesión, dos diócesis autenticadas y pruebas visuales jurídicas siguen pendientes.
