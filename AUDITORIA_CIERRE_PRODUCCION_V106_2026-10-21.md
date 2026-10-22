# SACRAMENTUM V106 · Acta de cierre, despliegue y pruebas

**Fecha:** 21 de octubre de 2026 (Colombia). **Commit funcional:** `1003a96`. **Rama:** `main`.

## Publicación comprobada

- Despliegue Vercel `https://sacramentum-final-pq5utbghc-jaiderherreras-projects.vercel.app`: Ready (18 segundos).
- Alias publicado: https://sacramentum-final.vercel.app
- HTTP 200 en `/`, `/chancery/decretos/archivo`, `/diocese/decretos/archivo`, `/parroquia/decretos/archivo` y `/parroquia/notificaciones-sacramentales`.
- CSS servido `/assets/index-CKKOgs_G.css`, 111.393 bytes, SHA-256 `B9C8839A3FD61ECC302251F0A90DB358BB211DE98D66E2584458587072453816`, idéntico a V105. La V106 no modificó componentes de interfaz.
- Limitación: una respuesta HTTP 200 en SPA no acredita navegación autenticada ni comportamiento visual.

## Seguridad de notificaciones de nulidad

Supabase aplicó la migración `require_valid_nullity_notice_before_receipt_v106`, con código en:
`supabase/migrations/20261022004255_require_valid_nullity_notice_before_receipt_v106.sql`.

Dos fallos comprobados y corregidos:
1. Un aviso de nulidad **sin decreto válido** podía generar una nota marginal en un Bautismo.
2. Un aviso **ya procesado, con nota asentada**, podía archivarse como `cancelled`, creando una contradicción institucional.

Postpatch la función receptora exige decreto activo de nulidad matrimonial y concordancia entre decreto, matrimonio, parroquia de origen, número de sentencia y Bautismo concreto, incluyendo nueva comprobación de identidad/partida V105. No se procesa aviso desde documento cancelado/revertido. El archivador rechaza procesados, notas aplicadas y acuses emitidos.

## Pruebas conductuales ejecutadas

- Prepatch: aviso ficticio sin decreto → se procesó, generó nota, después se archivó como cancelado; ROLLBACK.
- Postpatch negativo: aviso ficticio sin decreto → bloqueado, cero notas y estado pendiente.
- Postpatch negativo: documento origen cancelado → bloqueado, cero notas.
- Postpatch positivo: Cancillería genera nulidad con Matrimonio/Bautismo verificados en dos parroquias, Parroquia receptora marca leído, acepta y asienta una nota; se generó acuse, aceptación repetida no duplicó nota y archivo después de aceptar fue denegado.
- Confirmado 0 registros ficticios persistidos en Bautismos, Matrimonios, decretos, notificaciones, notas marginales y eventos de auditoría QA-V106.
- Las tablas de notificaciones tienen `authenticated UPDATE=false` y `INSERT=false`; las mutaciones comprobadas pasan por procedimientos autorizados.

## Automatización y auditoría

- Puerta V106: **25/26 controles ejecutables**, **339/339 pruebas sintéticas** aprobadas, **23 verificadores históricos** y compilación correcta.
- GitHub Actions: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/actions/runs/39702217101
  - `pruebas-funcionales`: SUCCESS.
  - `seguridad-dependencias`: FAILURE, cinco avisos HIGH existentes. No se cambió el umbral de auditoría.
- Plan maestro **325 controles distintos de los tests sintéticos**: **9 APROBADO, 66 EN_PROGRESO, 249 PENDIENTE y 1 FALLIDO**.

## Asesor de seguridad Supabase

Avisos actuales (no equivalen por sí mismos a vulnerabilidades confirmadas):
- 126 `authenticated_security_definer_function_executable`: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- 60 `pg_graphql_authenticated_table_exposed`: https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- 1 `auth_leaked_password_protection`: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Sigue abierto

Se requiere una política específica para **revocación jurídica posterior** de una sentencia ya comunicada y anotada. No debe resolverse con simple archivo o eliminación de notas. Pendientes asimismo doble sesión concurrente entre dos parroquias, validación de pantallas internas, examen de sentencia auténtica, conciliación de fuentes históricas incompletas, pruebas de recuperación de copia de seguridad y revisión individual de RPC y dependencias.

**Informe técnico:** `AUDITORIA_RECEPCION_NULIDAD_MATRIMONIAL_V106_2026-10-21.md`.
