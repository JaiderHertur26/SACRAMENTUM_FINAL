# SACRAMENTUM FINAL — V234 · Corrección de ACL internas de Supabase
**Fecha:** 27 de octubre de 2026 · Proyecto QA: `foczofcmwampjvlfbsqn` (todos los registros y cuentas son ficticios).

## Hallazgo comprobado con documentación de Supabase
La guía oficial https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema confirma que `supabase_admin` es una función interna reservada de Supabase y su ACL por defecto no se puede cambiar desde `postgres`; tampoco se puede conceder válidamente su membresía. Ese valor de catálogo **no debe bloquear por sí solo el lanzamiento de un proyecto nuevo**. No representa automáticamente acceso explotable a las tablas registrales.

Los controles anteriores V226–V233 exigían que **todos** los ACL predeterminados (incluidos los internos de Supabase) fueran cero. Ese criterio era imposible para una instalación normal y hacía aparecer como pendientes riesgos derivados únicamente de su presencia en catálogo. **Se ha corregido en V234 sin reducir las exigencias reales de seguridad.**

## Verificación REAL en QA (SQL de solo lectura)
- Privilegios futuros de objetos propios `postgres` para los roles públicos en tablas, secuencias y funciones: **0, 0 y 0**.
- Falta de revocación GLOBAL `PUBLIC EXECUTE` en funciones nuevas de `postgres`: **0**.
- Extensiones ubicadas en el esquema expuesto `public`: **0**.
- Relaciones y funciones ubicadas en `public` y pertenecientes a `supabase_admin`: **0 y 0**.
- Tablas propiedad de `supabase_admin` accesibles a `authenticated` con `TRUNCATE`: **0**.
- Todas las tablas públicas con RLS deshabilitada o con TRUNCATE concedido a `anon`/`authenticated`: **0**.
- Se conservan **en los informes**, como TELEMETRÍA, los números agregados de ACL internos de Supabase: 8 permisos delicados predeterminados, 2 de ejecución de funciones, 16 entradas futuras de tablas, 6 de secuencias, 2 de funciones y un propietario sin revocación global. No fueron alterados.

## Protección V234
El preflight `scripts/release-security-preflight-v234.sql` es exclusivamente SELECT, y ahora separa cifras atribuibles a `postgres` de las ACL internas de `supabase_admin`. La puerta `release-security-guard-v224.mjs`:

1. **Bloquea** toda asignación insegura a nuevos objetos propios de `postgres`, extensiones en `public`, objetos internos en `public`, accesos actuales a `TRUNCATE`, tablas sin RLS y funciones sin cadena de identidad.
2. **Obliga a reportar** los números de las ACL internas, aun cuando sean positivos. Rechaza cifras ausentes, negativas o incompatibles con los números del propietario `postgres`.
3. **Mantiene intactos** los requisitos de revisión manual real de las 152 funciones privilegiadas, así como el aislamiento de QA y la reconstrucción limpia de 159 migraciones.
4. Invalida toda atestación anterior: exige protocolo **V234** para permitir que cualquier proyecto NUEVO solicite modo oficial.

El antiguo guion `supabase/security/requires-authorized-supabase-admin-v226.sql` dejó de ofrecer cambios inviables sobre el propietario reservado y ahora devuelve un error explícito de obsolescencia `0A000` si alguien intenta ejecutarlo. El control legítimo de las ACL propias de `postgres`, ya corregidas en QA, sigue vigente.

## Qué NO está resuelto
Esto **no equivale a puesta en marcha oficial**. La base actual tiene miles de partidas ficticias y **4** conceptos históricos procedentes de un DBF de ensayo; el guard la deniega absolutamente. Faltan:
- Completar revisión semántica firma por firma y pruebas IDOR/BOLA para las 152 funciones `SECURITY DEFINER` disponibles por REST.
- Probar SMTP real y autenticación/reinicio de credenciales en el entorno definitivo.
- Crear un proyecto Supabase **nuevo e independiente** (puede incurrir en gastos, que deben aprobarse previamente), reconstruir el esquema SIN migrar datos de pruebas, aplicar catálogos aprobados y obtener un inventario vacío.
- Ensayar backup/restauración **sobre una base aislada** y verificar documentos eclesiásticos impresos, sellos, firmas y autorización institucional.

**Cuidado con «Restaurar a un proyecto nuevo» de Supabase:** según https://supabase.com/docs/guides/platform/clone-project, esa acción **también copia TODOS los datos y cuentas Auth**, por lo que no sirve para inaugurar SACRAMENTUM limpio a partir del QA. Debe usarse creación de base independiente y una reconstrucción de esquema sin datos, no clonar el ensayo.

## Evidencia
- `AUDITORIA_ACL_SUPABASE_RESERVADA_LIVE_V234.json`: indicadores exactos de catálogo obtenidos mediante SQL privilegiado de solo lectura, sin datos personales.
- `scripts/test-internal-default-acl-v234.mjs`: pruebas positivas, negativas, inconsistencias, ausencia de medidas, RLS, TRUNCATE y QA conocido.
- `scripts/release-security-preflight-v234.sql`: inventario reproducible de ACL propias e internas.
- `supabase/security/requires-authorized-supabase-admin-v226.sql`: interbloqueo explícito para impedir que se retome el antiguo procedimiento incompatible con Supabase.

Ningún registro, permiso ni función del Supabase QA cambió durante la V234. El trabajo de esta versión corrige un bloqueo en el análisis de seguridad y conserva los bloqueos auténticos de puesta en servicio.
