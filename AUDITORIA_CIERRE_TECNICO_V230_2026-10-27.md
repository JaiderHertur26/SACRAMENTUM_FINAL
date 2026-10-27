# SACRAMENTUM FINAL — CIERRE TÉCNICO V230 (27/10/2026)

**Ruta local:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`. **Supabase QA:** `foczofcmwampjvlfbsqn`.

## Corrección real aplicada
La app React se comunica por REST/RPC con Supabase y su código bajo `src/` no contiene dependencias del API GraphQL. Estaba instalado `pg_graphql 1.5.11`, que agrega Query/Mutation a partir del esquema. El Security Advisor avisaba sobre **64 objetos GraphQL visibles para authenticated**. Visibilidad del esquema no es equivalente a una fuga de registros; RLS ya restringía filas.

Se realizó una transacción de ensayo `BEGIN; DROP EXTENSION pg_graphql; ... ROLLBACK;`. Confirmó que GraphQL quedaba deshabilitado sin alterar filas y que la función marcador `graphql_public.graphql` contestaba `pg_graphql extension is not enabled.`.

Después se aplicó realmente la migración versionada `20261027115104_disable_unused_pg_graphql_v230.sql` en QA. Contiene `DROP EXTENSION IF EXISTS pg_graphql RESTRICT;` y una comprobación de que la extensión no siga activa. **No modifica ni borra partidas, cuentas o permisos RLS.** El endpoint GraphQL responde con el mensaje de deshabilitación.

## Resultado medido en el asesor de seguridad
- Advertencias de visibilidad GraphQL para `authenticated`: **64 → 0**.
- Advertencias restantes por funciones `SECURITY DEFINER` accesibles a `authenticated`: **152**. No se ocultan ni se consideran resueltas por deshabilitar GraphQL.
- Protección de contraseñas filtradas en Auth: **1 WARN**.
- RLS activado sin políticas, tablas privadas deliberadamente accesibles solo desde funciones autorizadas: **5 INFO**.

## Regresión después de deshabilitar GraphQL
- **8/8** sesiones reales GoTrue de cuentas ficticias aprobadas (incluye denegación de contraseña errónea).
- **24/24** intentos de crear partidas en parroquias o roles distintos rechazados desde RPC bajo sesión real.
- **14/14** ensayos transaccionales SQL ejecutados en PostgreSQL (Bautismo, Confirmación, Matrimonio, Exequias, decretos, conciliación, notas, folios, impresión, notificaciones y recuperación). Todos `BEGIN / ROLLBACK`, sin residuos.
- Los **13 recuentos privilegiados** coinciden con V228: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 69/233/1/1 pendientes, 2 decretos, 82 notas, 8 impresiones, 353 entradas de auditoría y 12 usuarios.
- El análisis de código React halló **cero** referencias funcionales a GraphQL.
- La auditoría de los 152 RPC REST y las ACL futuras de `supabase_admin` sigue pendiente.

## Control de release V230
La puerta de compilación `official` exige desde V230 un indicador adicional **`unused_pg_graphql_enabled=0`**, obtenido por la consulta `scripts/release-security-preflight-v230.sql`. Cualquier valor 1, ausente o un informe de protocolo anterior provoca rechazo. El guard conserva sus comprobaciones previas de RLS, FKs, RPC privilegiadas, default grants, base de datos completamente vacía y acta certificada. Se incorporó `scripts/test-disable-graphql-v230.mjs` al control maestro y GitHub Actions.

**No crear todavía registros oficiales:** todos los existentes son simulaciones. Cuando estén completos los controles pendientes, el primer registro real se hará en un proyecto Supabase nuevo, vacío e independiente. Nunca se convertirán ni trasladarán registros ficticios a oficiales.

## Pendientes que impiden concluir
1. Cambiar con autoridad legítima los permisos predeterminados del propietario `supabase_admin`, con prueba sobre una futura instalación.
2. Revisar y probar exhaustivamente las autorizaciones semánticas de las 152 funciones `SECURITY DEFINER` expuestas a autenticados.
3. Verificar recuperación de un respaldo, entrega real SMTP y validez de documentos físicos, firmas y sellos.
4. Construir y certificar una instancia de producción vacía e independiente, con inventarios y acta antes de operar.

**Avance técnico estimado V230: 97 %.** El porcentaje no reemplaza la aprobación jurídica, pastoral y de seguridad, ni significa que la base actual sea oficial.
