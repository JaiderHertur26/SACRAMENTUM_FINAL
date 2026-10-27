# SACRAMENTUM FINAL V236 — Inmutabilidad verificable del catálogo de 152 RPC privilegiadas
**Fecha:** 27 de octubre de 2026. **Ambiente:** `foczofcmwampjvlfbsqn` (exclusivamente QA; todas las cuentas y partidas son ficticias).

## Hallazgo y mejora
El control V233 comprobaba que las 152 funciones `SECURITY DEFINER` disponibles para `authenticated` podían llegar a una referencia textual de `auth.uid()`. Esta garantía es limitada: una función puede mantener la referencia de identidad y modificar sin autorización su lógica de lectura o escritura. V236 agrega un **detector de cambios exactos del catálogo** de RPC que obliga a revisar toda discrepancia antes de una eventual publicación oficial.

Se obtuvo con **SELECT de solo lectura** una huella del catálogo: 152 funciones; MD5 agregado `4ded9ebe1d9cde435befee3f8b131222`. Cada entrada contiene el nombre, la firma canónica de parámetros y el MD5 de `pg_get_functiondef`; se ordena por nombre y firma y se concatena con salto de línea. Se incluye el código de la función, configuración y cabecera de PostgreSQL, sin guardar nombres de personas, contraseñas ni contenido registral.

## Cambios
- `scripts/release-security-preflight-v236.sql`: agrega `privileged_rpc_catalog_count` y `privileged_rpc_catalog_md5`.
- `release-security-guard-v224.mjs`: deniega cualquier catálogo distinto de **152** o huella diferente a la fuente SQL verificada, además de todos los filtros previos V235.
- `release-guard-core-v223.mjs`: exige protocolo **V236** y rechaza las actas V235 o anteriores.
- `scripts/test-privileged-rpc-catalog-v236.mjs`: pruebas de conteos cambiados, omisiones, huellas alteradas, protocolos antiguos y ausencia de revisión semántica, enlazadas en auditoría local y CI.
- `AUDITORIA_HUELLAS_RPC_LIVE_V236.json`: evidencia de los valores reales de QA, con métricas exclusivamente y sin datos identificables.

## Límites que deben respetarse
Una coincidencia de hash es **control de deriva**, no seguridad probada; MD5 no constituye firma institucional ni evita que una persona con capacidad de alterar la atestación la falsifique. La configuración definitiva requiere consulta independiente, acta verificada y ensayos por rol/diocesis/parroquia. En particular, **0 de las 152 funciones tienen aprobación semántica formal** y la coincidencia con este digest NO cambia esa cifra. Si una migración revisada modifica legítimamente cualquier función, se actualiza la huella únicamente después de inspección, pruebas de jurisdicción y aprobación documental.

No se creó un nuevo proyecto Supabase ni se migraron, borraron o oficializaron datos QA. Siguen pendientes: revisión firma por firma, restauración efectiva en base aislada, SMTP, instalación limpia independiente y aceptación institucional de documentos/sellos/firmas. No se habilita registro oficial.
