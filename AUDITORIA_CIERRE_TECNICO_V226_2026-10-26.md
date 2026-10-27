# SACRAMENTUM FINAL — CIERRE TÉCNICO V226 · ENDURECIMIENTO DE SEGURIDAD

**Fecha:** 26/10/2026 en Colombia (SQL verificado desde UTC 27/10/2026).
**Máquina:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.
**Estado:** Solo QA. Todos los registros existentes son ficticios y ninguno pasará al sistema oficial.

## Correcciones reales aplicadas y verificadas
- **Permisos predeterminados del propietario PostgreSQL `postgres` endurecidos en Supabase QA.** Los nuevos objetos bajo `public` ya no heredan permisos automáticos para `anon`, `authenticated` o `service_role` (tablas, secuencias, funciones). En funciones, también se revocó la concesión global implícita de `EXECUTE` a `PUBLIC`.
- Se probó creando una tabla y función **dentro de una transacción de ensayo reversible**. Ambas denegaron SELECT/EXECUTE a `anon` y `authenticated`. `ROLLBACK` eliminó los objetos de prueba. **5.040** bautismos de la base QA seguían intactos.
- No se modificaron permisos de objetos ya existentes, ni políticas de RLS, ni usuarios, ni filas sacramentales, ni datos históricos. La autorización de `supabase_admin` no se tomó prestada ni simuló.

## Seguridad de lanzamiento V226
- `scripts/release-security-preflight-v226.sql`: inventario de solo lectura ampliado; detecta privilegios predeterminados de los propietarios `postgres` y `supabase_admin`, incluyendo las concesiones globales implícitas de funciones.
- `release-security-guard-v224.mjs`: elevado a exigencias V226 sin romper su API histórica. El modo `official` se rechaza si hay permisos futuros automáticos a `anon`/`authenticated` sobre tablas, secuencias, funciones, o si un propietario carece de revocación global de ejecución pública.
- `release-guard-core-v223.mjs`: actas anteriores a V226 dejan de ser suficientes. Sin censo sin datos y sin revisión formal de RPC el modo oficial continúa denegado.
- Dos scripts independientes versionados en `supabase/security/`: `qa-postgres-default-privileges-v226.sql` (ya ejecutado en QA), y `requires-authorized-supabase-admin-v226.sql` (sin ejecutar; requiere administración habilitada).
- `scripts/test-security-default-privileges-v226.mjs` con 17 regresiones nuevas agregadas al test gate y a GitHub Actions. Se actualizaron las actions `checkout` y `setup-node` a v5.
- `AUDITORIA_PRIVILEGIOS_PREDETERMINADOS_LIVE_V226.json`: evidencia del cambio; `AUDITORIA_RPC_INVENTARIO_LIVE_V226.json`: catálogo de 152 funciones por firma y hash, sin código fuente ni credenciales.

## Resultados de QA
**2.040/2.040 pruebas sintéticas aprobadas** y **30/30 controles de calidad**. Compilación Vite correcta y auditorías de dependencias sin hallazgos por encima del umbral. La compilación intencionalmente configurada `official` contra la base QA fue rechazada.

## Lo pendiente: no ocultar
- El rol `supabase_admin` tiene **16 concesiones futuras de tablas, 6 de secuencias y 2 de funciones** a roles de aplicación, de las cuales **8 son peligrosas** según el criterio de V224. Además **1 propietario** carece de revocación global explícita de `PUBLIC EXECUTE`. El rol actual `postgres` **no es miembro** de `supabase_admin`; no debe fingirse que puede corregirlo.
- El inventario de **152** `SECURITY DEFINER` expuestas a `authenticated` identificó 134 referencias directas a `auth.uid()`, 83 referencias a verificadores delegados (superpuestas) y 101 funciones con texto de escritura. Estos son indicadores **estáticos**, no garantía de seguridad. Falta revisar todas las rutas de autorización, fallos y cambios de estado.
- No se realizaron nuevas pruebas UI E2E de inicio de sesión real, correo, respaldos/restitución, impresión física ni apertura de base oficial limpia; estos procesos siguen bloqueadores.
- Al completar pruebas, se debe crear un **proyecto Supabase totalmente nuevo**, comprobar 0 usuarios y 0 registros operativos ficticios, con ACL seguras y acta antes de la primera partida oficial. **No borrar ni trasladar los datos de QA ahora.**

## Próxima prioridad
**Resolver supabase_admin con autoridad válida**, revisar 152 RPC por firma con pruebas de autorización negativa, certificar flujos completos de Cancillería/sacramentos y el arranque limpio desde cero. Este orden impide presentar registros ficticios como oficiales.

**Porcentaje técnico estimado V226: 94 %**, basado en nueve áreas con pesos predefinidos. La cifra no reemplaza una certificación oficial.
