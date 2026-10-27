# SACRAMENTUM FINAL — V235 · Blindaje de privilegios globales en PostgreSQL
**27 de octubre de 2026. Proyecto actual exclusivamente QA:** `foczofcmwampjvlfbsqn`.

## Riesgo corregido
La puerta V234 exigía cero permisos predeterminados de nuevos objetos `postgres` en el esquema `public`, pero no comprobaba **con métricas propias** las concesiones globales de `postgres` sobre tablas y secuencias. Una configuración global insegura puede propagarse a futuros objetos incluso si una inspección limitada al esquema `public` devuelve cero.

## Acción V235
- El preflight **solo lectura** `scripts/release-security-preflight-v235.sql` cuenta de forma independiente `postgres_global_table_grants` y `postgres_global_sequence_grants` mediante `pg_default_acl.defaclnamespace=0` y `aclexplode`, para PUBLIC, anon y authenticated.
- `release-security-guard-v224.mjs` obliga a que ambas métricas existan y sean exactamente el entero 0. Los números negativos, ausentes, decimales y permisos nuevos deniegan la publicación.
- `release-guard-core-v223.mjs` exige **V235**: un certificado V234 ya no es admisible para una instalación oficial futura.
- Test adversarial `scripts/test-global-default-acl-v235.mjs` incorporado tanto a la auditoría local como a GitHub Actions.

## Verificación en base QA
Una consulta privilegiada de **solo lectura** al catálogo `pg_default_acl` para las ACL globales del propietario `postgres` devolvió **0 filas** concedidas a PUBLIC/anon/authenticated en tablas, secuencias y funciones. La evidencia agregada está en `AUDITORIA_ACL_GLOBALES_POSTGRES_V235.json` y no contiene personas ni contraseñas. **No se modificó la base.**

## Límites vigentes
Este blindaje es **una corrección preventiva de la puerta oficial, no la autorización final**. Siguen pendientes la revisión semántica y las pruebas IDOR de las 152 RPC privilegiadas, instalación certificada en un nuevo Supabase sin los datos ficticios QA, ensayo aislado de restauración, SMTP real, documentos físicos/sellos y aceptación institucional. No se ha ejecutado creación de proyecto de pago ni ninguna migración de registros de prueba.

La referencia V234 para las ACL internas inmodificables de `supabase_admin` sigue válida: se reportan como telemetría y se bloquea la exposición real; **no se deben intentar alterar roles reservados**. Los registros de la base QA siguen sin validez oficial.
