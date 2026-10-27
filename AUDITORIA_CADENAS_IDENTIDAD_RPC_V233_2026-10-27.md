# SACRAMENTUM FINAL — V233 · Cadenas de identidad para 152 funciones privilegiadas

**27 de octubre de 2026** · Supabase **QA** `foczofcmwampjvlfbsqn` · **NINGÚN DATO OFICIAL**.

## Auditoría viva de autorización (solo lectura)
Se verificó con metadatos reales de PostgreSQL la lista completa de **152 funciones SECURITY DEFINER** a las que el rol `authenticated` puede acceder. **137** consultan directamente `auth.uid()`; para las otras **15** se trazó su grafo de llamadas SQL desde el código de `pg_proc`. Las 15 alcanzan una función que referencia `auth.uid()` **en una llamada**, sin observar ninguna cadena sin referencia de identidad. Son 15 funciones de corrección y reposición sacramental, Cancillería, notificaciones matrimoniales, mensajería y consulta/registro histórico.

**Límite esencial:** una referencia a `auth.uid()` es una condición *necesaria pero no suficiente*. Una llamada puede consultar el usuario y aun así permitir un IDOR/BOLA o acceso a otra diócesis. Esta auditoría automatizada **NO da por formalmente aprobada ninguna de las 152 firmas**, no descarta SQL dinámico indirecto, no es pentest y no reemplaza pruebas de competencia institucional, documentación y autorización jurídica. El catálogo detallado de las quince cadenas está en `AUDITORIA_RPC_CADENAS_IDENTIDAD_LIVE_V233.json`.

## Nueva puerta para impedir un estreno inseguro
Se agregó la consulta **solo lectura** `scripts/release-security-preflight-v233.sql`, que construye recursivamente relaciones entre funciones y exige dos métricas:
- `privileged_rpc_without_auth_identity_path` = **0** para todas las funciones privilegiadas expuestas a usuarios autenticados.
- `privileged_rpc_using_delegated_identity` medida, con valor QA actual **15** (puede cambiar tras una actualización revisada).

La validación `release-security-guard-v224.mjs` rechaza conteos omitidos, negativos, obsoletos o cualquier nuevo camino privilegiado sin referencia de identidad. El protocolo del certificado de apertura subió de **V231 a V233**. Las atestaciones V231 o anteriores quedan **invalidadas** aun si sus otras cifras son favorables. El proyecto QA sigue bloqueado de forma incondicional.

La consulta utiliza una búsqueda textual explícita con máximo seis saltos y resolución de nombres `public.nombre(`; una sobrecarga u otra representación de llamada podría producir falsos positivos/negativos. Se necesita un revisor de autorización por procedimiento y prueba real con cuentas de jurisdicciones opuestas antes de aceptar el `manual_privileged_rpc_review`.

## Seguridad actual y bloqueos reales (no resueltos por V233)
- El rol con acceso al SQL es `postgres`, **sin pertenencia a `supabase_admin`**. No puede modificar legítimamente los permisos por defecto de ese propietario. En QA existen **15 filas de ACL predeterminadas** para `supabase_admin`; son pendientes peligrosos que el preflight actual correctamente rechaza.
- La QA contiene 4 conceptos heredados de un archivo DBF de prueba, y más de 95.000 filas del esquema público. **Ningún registro actual debe migrarse** al sistema oficial.
- Falta el ensayo de reconstrucción de esquema sobre un Supabase separado, la restauración verificable de un respaldo y la salida SMTP. El ambiente definitivo no se ha creado.
- Se deben revisar semánticamente las 152 funciones (no solamente detectar cadenas a `auth.uid()`), especialmente efectos, firmas y separación Parroquia/Diócesis/Cancillería.
- Para crear un nuevo proyecto Supabase puede existir un **cargo recurrente**: se requiere mostrar el costo concreto y obtener aprobación expresa antes de contratarlo.

## Evidencias y modo de ejecución
- `AUDITORIA_RPC_CADENAS_IDENTIDAD_LIVE_V233.json`: resultado real, con nombres y firmas y sin datos de usuarios.
- `scripts/release-security-preflight-v233.sql`: consulta privilegiada READ-ONLY, usada como prueba en la QA.
- `scripts/test-rpc-identity-path-v233.mjs`: casos adversariales y verificaciones del grafo, incorporados al master quality gate y CI de GitHub.
- `release-security-guard-v224.mjs` y `release-guard-core-v223.mjs`: deniegan publicación oficial si falta evidencia V233.
- Esta etapa no altera la base, no importa personas, no desactiva RLS y no habilita modo oficial.

**Conclusión:** trazabilidad de identidad **152/152**, **seguridad semántica y apertura oficial NO certificadas**.
