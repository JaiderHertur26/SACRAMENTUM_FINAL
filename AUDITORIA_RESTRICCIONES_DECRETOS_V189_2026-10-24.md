# SACRAMENTUM V189 — Validación de restricciones jurídicas de decretos

**Fecha:** 24 de octubre de 2026, Colombia.
**Proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`
**Base:** Supabase «REGISTRO SACRAMENTOS» `foczofcmwampjvlfbsqn`.

## Hallazgo de entrada
PostgreSQL `public.decretos` tenía dos restricciones `CHECK` previamente creadas pero sin validación de datos existentes: `chk_decretos_sacrament_type` y `chk_decretos_status`.
Las dos filas existentes no violaban los valores de tipo ni estado. En el esquema público eran las únicas dos restricciones pendientes.

## Corrección aplicada
Migración de Supabase aplicada y listada: **`20261024201212_validate_decree_check_constraints_v189`**.
Se ejecutaron `ALTER TABLE public.decretos VALIDATE CONSTRAINT` para ambas reglas con límites de espera de bloqueo y duración.
Comprobación posterior de `pg_constraint`: **2/2 con `convalidated=true`** y **0 restricciones no validadas en esquema público**.
No se cambiaron filas, identidades, roles, funciones, índices ni permisos.

## Verificación real reversible
- `scripts/qa-readonly-decree-check-validation-v189.sql`: `BEGIN READ ONLY`/`ROLLBACK`, dos restricciones activas y revisadas, dos decretos existentes conformes y cero restricciones públicas pendientes.
- `scripts/qa-rollback-decree-status-v189.sql`: creación de un decreto documental totalmente ficticio por Cancillería en una transacción `BEGIN/ROLLBACK`; intentos independientes de asignarle estado fuera de catálogo y tipo sacramental inválido. **Ambos rechazados**, la fila original de prueba permaneció intacta durante la transacción.
- Una nueva consulta después confirmó **0 decretos QA V189 persistentes**.
- `scripts/test-decree-check-validation-v189.mjs`: **5 pruebas sintéticas** de migración, seguridad y reproductibilidad SQL; incorporadas al gate general.
- Gate estricto **V189: 1.465/1.465** pruebas Node, **30/30** verificaciones, compilación y auditoría de dependencias aprobadas.

## Pendientes y limitaciones
- Una restricción `CHECK` en PostgreSQL permite `NULL` salvo que exista restricción explícita `NOT NULL`. `decretos.sacrament_type` sigue permitiendo `NULL` en su esquema; los registros existentes son completos, pero se requiere verificar compatibilidad de decretos documentales/históricos antes de fortalecer esa columna.
- Las validaciones `CHECK` no certifican por sí mismas la compatibilidad de cada concepto jurídico o la autorización real de emisión; **12.03 sigue EN_PROGRESO**.
- Supabase advisors del 24/oct/2026 mantienen 3 tipos de advertencia de seguridad: 64 objetos detectados como visibles en el esquema GraphQL para autenticados, 146 advertencias de ejecución de funciones `SECURITY DEFINER` por autenticados y protección de contraseñas filtradas por configurar. Son advertencias que requieren auditoría contextual; no se atribuyen a V189 ni representan automáticamente acceso a filas por encima de RLS. Referencias:
  - https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
  - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  - https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- E2E autenticado entre diócesis, concurrencia física multi-sesión y ejecución jurídica completa siguen pendientes.
- **El porcentaje formal no cambia:** 15 de 325 controles aprobados = 4,6 %. Evidencia nueva agregada a control 12.03 sin adjudicar aprobación integral.
