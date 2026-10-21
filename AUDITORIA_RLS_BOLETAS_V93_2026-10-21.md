# SACRAMENTUM · Auditoría V93 de autoridad sobre boletas sacramentales

**Fecha:** 21/10/2026. **Identificador:** V93-SEC-002. **Severidad:** ALTA por vulneración de la jerarquía administrativa y posible alteración de boletas ajenas.

## Hallazgo previo: Admin General podía escribir boletas desde la API de datos

Las políticas RLS `pending_baptisms_insert_owner`, `pending_baptisms_update_owner`, `pending_baptisms_delete_owner` y las tres equivalentes de `pending_confirmations` aceptaban expresamente `is_app_admin()`, además del rol Parroquia propietario.

Eso contradice la autoridad institucional definida: el Administrador General administra diócesis y usuarios diocesanos, mientras el registro sacramental corresponde a la Parroquia. El hecho de que las RPC del módulo validaran la autoridad del actor no impedía que se eludiera el flujo de interfaz mediante una escritura directa en PostgREST.

**Prueba controlada ANTES de la corrección:** con el rol SQL `authenticated` y la identidad de Administrador General, `INSERT INTO public.pending_baptisms` en parroquia operativa aceptó una boleta de identidad totalmente ficticia. El ensayo retornó `actor_role = admin_general`, `inserted_from_admin_general = 1`. Terminó en `ROLLBACK`.

## Corrección aplicada

Migración Supabase `restrict_pending_sacrament_writes_to_parish_v93`, archivo:
`supabase/migrations/20261021180054_restrict_pending_sacrament_writes_to_parish_v93.sql`

Se actualizaron exactamente seis políticas RLS mediante `ALTER POLICY`, sin reescribir ni borrar boletas de ningún sacramento. Para `INSERT`, `UPDATE` y `DELETE` de `pending_baptisms` y `pending_confirmations` se exige:

```sql
public.current_app_role() = 'parish'
AND parish_id = public.current_app_parish_id()
```

En UPDATE se exige tanto con `USING` (registro original) como con `WITH CHECK` (registro posterior al cambio), impidiendo además reasignar la boleta a otra parroquia. Los permisos técnicos de la tabla no se revocaron porque las pantallas de Parroquia pueden necesitar operaciones directas bajo RLS.

## Validación real con cuatro roles y dos entidades

**Matrices en transacción PostgreSQL con ROLLBACK**: todos los datos de boleta fueron ficticios y se ligaron temporalmente a la parroquia operativa. Las identidades institucionales se utilizaron exclusivamente para simular roles, sin divulgar identificadores ni credenciales.

| Rol | INSERT Bautismo | INSERT Confirmación | UPDATE de ambas | DELETE de ambas |
|---|---|---|---|---|
| Administrador General | Denegado | Denegado | 0 | 0 |
| Diócesis | Denegado | Denegado | 0 | 0 |
| Cancillería | Denegado | Denegado | 0 | 0 |
| Parroquia propietaria | Permitido | Permitido | 1 por tabla | 1 por tabla |

**24/24 comprobaciones conductuales positivas y negativas**, incluyendo 8 INSERT, 8 UPDATE y 8 DELETE. Todos los rechazos y permisos coincidieron con la matriz esperada.

Tras rollback, consultas SQL de comprobación regresaron:
- `test_baptism_pending_remains = 0`
- `test_confirmation_pending_remains = 0`
- `prior_document_test_remains = 0`

## Regresión automática

- Nuevo `scripts/test-pending-ownership-v93.mjs` con **8 pruebas** sobre las seis políticas, ausencia de la excepción de `is_app_admin` y garantía de no manipular datos desde la migración.
- Añadido a `scripts/audit-gate-v90.mjs` y al trabajo de pruebas funcionales de GitHub Actions.
- La suite esperada es **219 pruebas sintéticas** (206 de V89 + 5 de V92 + 8 de V93), además de los 23 verificadores históricos. Los ensayos estáticos son complementarios a las 24 pruebas reales SQL ejecutadas.

## Alcance y limitaciones

Esta corrección protege boletas pendientes de Bautismo y Confirmación. No certifica que las 73 tablas, las 128 funciones privilegiadas restantes o las demás operaciones administrativas estén libres de fallas.

Las cinco alertas HIGH de `npm audit` siguen abiertas y el control de seguridad CI debe seguir bloqueado hasta su remediación compatible con la interfaz. No se considera aprobada la auditoría integral de 325 controles.
