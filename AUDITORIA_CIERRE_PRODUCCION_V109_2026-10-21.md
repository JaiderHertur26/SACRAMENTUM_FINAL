# SACRAMENTUM V109 · Acta de publicación y evidencias

**Fecha:** 21 de octubre de 2026, Colombia. **Versión:** V109. **Commit funcional:** `43b7a24`. Rama `main` sincronizada.

## Publicación efectiva

- **Vercel Ready:** https://sacramentum-final-n8628rztc-jaiderherreras-projects.vercel.app
- **Alias productivo:** https://sacramentum-final.vercel.app
- HTTP 200 en `/`, `/chancery/decretos/archivo?type=tribunal&sacrament=matrimonio`, `/diocese/decretos/archivo` y `/parroquia/decretos/archivo?type=tribunal&sacrament=matrimonio`.
- CSS real servido `/assets/index-DVDdktXC.css`: **111.724 bytes**; SHA-256 `874FBBEE50499B2382CC29D8A2DEDB2AD9F4BF88F11AC452DC701E5DDA9C119C`. Conserva huella V108; nuevos controles reutilizan clases.
- HTTP 200 de SPA y conservación del CSS NO demuestran navegación visual autenticada.

## Registro de decisiones no verificadas

Se aplicó `court_decision_receipt_unverified_v109` en Supabase. La tabla `nullity_court_decision_receipts` y la RPC `register_nullity_court_decision_receipt_v109` registran recepción de documentación atribuida al Tribunal **sin considerar auténtico su contenido ni ejecutar sus efectos**.

Permisos: solo Cancillería activa de la diócesis puede registrar. La RPC exige sentencia vigente de nulidad y Matrimonio anulado, caso en estudio, actuación formal previa de inicio, documento y autoridad identificados, fecha no futura, resumen sustantivo. Un documento duplicado es rechazado.

RLS: Cancillería, Diócesis y Parroquia del expediente pueden consultar; Admin General y anon quedan fuera. Ningún usuario autenticado puede hacer INSERT/UPDATE directo. Campo `verification_state` solo admite `unverified`.

## Pruebas SQL reales, exclusivamente ficticias con ROLLBACK

1. Admin General, Diócesis y Parroquia: **3/3 denegaciones** de recepción.
2. Cancillería antes de iniciar estudio: **rechazado**.
3. Tras inicio correcto, Cancillería registró una recepción que **declara posible rectificación**; quedó `unverified`.
4. Duplicación de la referencia: **rechazada**.
5. Se comprobó sentencia `active`, Matrimonio `nullified`, revisión `under_legal_review`, sin modificar registros.
6. Auditoría creada dentro de transacción: una entrada.
7. RLS verificado: Admin General 0, Diócesis 1, Cancillería 1, Parroquia titular 1.
8. Verificación posterior: **0 documentos de recepción**, 0 casos, 0 decretos QA, 0 Matrimonios QA, 0 eventos de auditoría QA persistidos.
9. Restricciones de INSERT/UPDATE, lectura anónima y ejecución anónima confirmadas en SQL.

## Regresión y automatización

- V109 añade **26 pruebas sintéticas**; acumulado **407/407 aprobadas** y **23 verificadores históricos**.
- Compilación Vite de producción satisfactoria.
- Puerta `AUDITORIA_PUERTA_CALIDAD_V109.json`: **25/26**, único fallo `dependencias-externas` por **5 HIGH**.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39709009305
  - `pruebas-funcionales`: SUCCESS.
  - `seguridad-dependencias`: FAILURE; umbral sin relajar.
- Auditoría maestra de **325 controles distintos**: **9 APROBADO, 70 EN_PROGRESO, 245 PENDIENTE, 1 FALLIDO**.

## Avisos de Supabase

- 129 `authenticated_security_definer_function_executable` (WARN): https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- 63 `pg_graphql_authenticated_table_exposed` (WARN): https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- 1 `auth_leaked_password_protection` (WARN): https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Estas advertencias no prueban por sí mismas ese número de vulnerabilidades.

## Falta para ejecutar una decisión

No se implementó validación jurídica o criptográfica de un documento real, aprobación por autoridad canónica competente, ni mecanismo de rectificación de efectos. No puede trasladarse a una partida una comunicación solo porque fue recibida. Se requiere diseño con prueba de autenticidad y competencia, revisión de alcance, registro de nuevo acto, comunicación correctiva, notas complementarias sin borrado, acuse y restauración verificable.

Continúan pendientes pruebas E2E autenticadas, simultaneidad de varias parroquias (solo hay un usuario parroquial activo en esta instalación), recuperación de respaldos y resolución de los cinco HIGH. No se declara certificación general.

**Informe técnico:** `AUDITORIA_RECEPCION_DECISION_TRIBUNAL_V109_2026-10-21.md`.
