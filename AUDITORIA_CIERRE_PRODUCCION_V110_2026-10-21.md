# SACRAMENTUM V110 · Acta de publicación y evidencias de doble cotejo

**Fecha:** 21 de octubre de 2026, Colombia. **Commit funcional:** `25065f4`; rama `main`. **Versión:** 110.

## Producción

- Despliegue Vercel **Ready**: https://sacramentum-final-2s8d1u012-jaiderherreras-projects.vercel.app
- Alias productivo: https://sacramentum-final.vercel.app
- Rutas HTTP 200: `/`, `/chancery/decretos/archivo?type=tribunal&sacrament=matrimonio`, `/diocese/decretos/archivo` y `/parroquia/decretos/archivo?type=tribunal&sacrament=matrimonio`.
- CSS real `/assets/index-DVDdktXC.css`, 111.724 bytes, SHA-256 `874FBBEE50499B2382CC29D8A2DEDB2AD9F4BF88F11AC452DC701E5DDA9C119C`, idéntico a V109.
- Respuesta HTTP 200 en una SPA **no demuestra** que las pantallas autenticadas funcionen ni que hayan sido inspeccionadas visualmente.

## Backend y pruebas transaccionales

Aplicada en Supabase `dual_control_court_receipt_review_v110`:
- La RPC exige cotejo de Cancillería antes del contraste de Diócesis, por usuario distinto al primer revisor y al receptor original.
- Roles sin competencia y escrituras duplicadas denegados; contactos y referencias documentados.
- Vínculos de caso, sentencia, parroquia y diócesis comprobados antes de escribir.
- Ambas actuaciones se agregan al registro con auditoría; no cambian sentencia, Matrimonio, Bautismo, notas, avisos, acuses o recepción original `unverified`.
- Dos ciclos reales ficticios (hallazgos discrepantes y hallazgos concordantes); RLS: Admin General 0, Diócesis 2, Cancillería 2, Parroquia propietaria 2.
- **0 cotejos, 0 recepciones, 0 casos, 0 decretos QA, 0 Matrimonios QA y 0 auditorías QA persistidos** tras ROLLBACK.
- Tabla protegida: `authenticated INSERT=false`, `UPDATE=false`; `anon SELECT=false` y RPC no ejecutable anónimamente.

## Interfaces

- Cancillería: botón de primer cotejo e indicación de contraste independiente pendiente o documentado.
- Diócesis: botón para segundo cotejo con referencia externa, fecha, canal y explicación, disponible cuando ya existe cotejo de Cancillería.
- Parroquia: acceso informativo por jurisdicción, sin facultad para editar.
- Ningún botón o RPC de esta versión certifica autenticidad judicial ni ejecuta revocación.

## Pruebas, seguridad y criterio de aceptación

- `scripts/test-dual-control-court-receipts-v110.mjs`: **28 pruebas sintéticas**.
- Puerta V110: **435/435 pruebas sintéticas**, **23 verificadores históricos**, compilación Vite correctos.
- **Puerta completa 25/26:** la comprobación `dependencias-externas` no terminó con informe válido; `npm audit` agotó el timeout local de 120 segundos. Por ello la seguridad de dependencias **no se aprueba**. El último informe válido anterior detectó cinco HIGH todavía sin remediación acreditada.
- Auditoría maestra: **325 controles** separados de los 435 tests: **9 APROBADO, 70 EN_PROGRESO, 245 PENDIENTE, 1 FALLIDO**.
- GitHub Actions de código V110: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39710977323 — ver el resultado final de sus dos jobs; no equiparar un job funcional con aprobación de seguridad.

## Avisos del asesor Supabase

- `authenticated_security_definer_function_executable`: 130 WARN; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- `pg_graphql_authenticated_table_exposed`: 64 WARN; https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- `auth_leaked_password_protection`: 1 WARN; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Son avisos de análisis, no afirmaciones de 195 vulnerabilidades explotables.

## Pendientes

Autenticación material de resoluciones de Tribunal, verificación de firma y cadena de custodia, competencia canónica y acto jurídico de ejecución (no implementado); concurrencia independiente entre procesos reales, restauración probada de respaldos y recorrido visual autenticado por todas las pantallas. Hay solo un usuario parroquial activo para los ensayos de este entorno, por lo que la comparación con dos parroquias en sesiones paralelas sigue abierta.

**Detalle técnico:** `AUDITORIA_DOBLE_COTEJO_DECISIONES_V110_2026-10-21.md`.
