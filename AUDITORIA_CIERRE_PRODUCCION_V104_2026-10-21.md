# SACRAMENTUM V104 — Acta de publicación y revisión final

**Fecha:** 21 de octubre de 2026, hora colombiana. **Versión:** V104. **Commit de implementación:** `325eab7`. **Rama:** main.

## Publicación comprobada

- Producción Vercel **Ready**: https://sacramentum-final-10vh7d9va-jaiderherreras-projects.vercel.app
- Alias productivo: https://sacramentum-final.vercel.app
- HTTP 200 en `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo`, `/parroquia/decretos/archivo`.
- CSS real servido: `/assets/index-CKKOgs_G.css`, **111.393 bytes**, SHA-256 `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`; misma huella que V103. No se editaron pantallas ni estilos.
- HTTP 200 en rutas SPA **no prueba** contenido autenticado; las pantallas interiores siguen pendientes de comprobación visual.

## Seguridad de las siete RPC de decretos

Migración `reserve_marriage_funeral_decrees_to_chancery_v104` aplicada en Supabase. Las siete funciones analizadas de corrección, reposición, nulidad y reversión de Matrimonios y Exequias exigen Cancillería y comprueban ámbito diocesano.

Se efectuaron **28 pruebas anteriores al parche**, todas con UUID inexistentes para evitar la modificación de documentos reales; **tres pruebas reales posteriores acotadas** (Administrador General denegado, Diócesis denegada, Cancillería llega a verificación de datos). La nueva matriz masiva posterior fue bloqueada por la plataforma y **no cuenta como aprobada**.

Se completaron **dos ciclos reversibles de Cancillería**:
- Exequias: crear reposición ficticia y revertir su decreto.
- Matrimonio: crear reposición ficticia y revertir su decreto.

Ambas reposiciones quedaron en estado `reversed` antes del ROLLBACK. Consultas posteriores: **0** decretos, matrimonios, exequias, notas y auditorías QA-V104.

## Pruebas y automatización

- `scripts/test-decree-authority-v104.mjs`: 13 pruebas de regresión nuevas.
- `AUDITORIA_PUERTA_CALIDAD_V104.json`: **313/313 pruebas sintéticas** correctas, **23 verificadores históricos** y build correcto.
- Puerta de calidad **25/26**: único fallo `dependencias-externas`, con **5 HIGH**; no se modificaron umbrales de aceptación.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39698573704 — `pruebas-funcionales: SUCCESS`, `seguridad-dependencias: FAILURE`.

## Avisos de Supabase y de npm

- Supabase Security Advisors: 126 `authenticated_security_definer_function_executable`, 60 `pg_graphql_authenticated_table_exposed`, 1 `auth_leaked_password_protection`. Cada cifra representa un aviso del asesor, **no un total de vulnerabilidades confirmadas**.
- Referencias oficiales:
  - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  - https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
  - https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- `scripts/V104_NPM_AUDIT.json` conserva evidencia de las cinco alertas HIGH del árbol Tailwind CSS 3 y sus dependencias. Una actualización mayor a Tailwind CSS 4 exige pruebas visuales antes de producción; no se ha simulado una resolución removiendo los controles.

## Plan de 325 controles

**9 APROBADO, 59 EN_PROGRESO, 256 PENDIENTE, 1 FALLIDO**.

Se seguirá con los flujos jurídicos de nulidad matrimonial y corrección en cuatro sacramentos; auditoría individual de RPC, concurrencia, recuperación completa de respaldos y pruebas de pantalla autenticadas. Ninguna de esas tareas se considera aprobada por el simple éxito de pruebas sintéticas o respuestas HTTP.
