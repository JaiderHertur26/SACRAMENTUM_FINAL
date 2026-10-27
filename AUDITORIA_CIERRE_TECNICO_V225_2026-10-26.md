# SACRAMENTUM FINAL — CIERRE TÉCNICO V225
**Fecha:** 26 de octubre de 2026, Colombia. **Proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Avance comprobado
La V225 amplía la verificación desde pruebas sintéticas hacia **las políticas RLS reales del proyecto Supabase QA**, sin abrir sesiones de usuarios reales ni alterar registros.

- **12 identidades ficticias existentes**: 2 Administradores Generales, 3 usuarios diocesanos, 2 Cancillerías y 5 usuarios parroquiales.
- **13 tablas por identidad**, **156 conteos** con `BEGIN READ ONLY; SET LOCAL ROLE authenticated;`, un `request.jwt.claim.sub` limitado a la transacción y `ROLLBACK`.
- **12/12** contextos coinciden con la visibilidad justificada por la institución y el territorio, considerando que **1.552** archivos legacy tienen diócesis pero no parroquia.
- Se comprobó la diferenciación real de permisos: Administrador General con visibilidad general, Diócesis/Cancillería en su jurisdicción y Parroquia solo en la suya, según las tablas y perfiles examinados.
- La parroquia con datos de prueba vio **48 Bautismos, 5 Confirmaciones, 1 Matrimonio, 1 Exequia**, y cero partidas ajenas para los sacramentos verificados.
- El rol autenticado con identificador ficticio **sin perfil activo reconocido** obtuvo **0 filas en las 13 tablas** y no pudo acceder a una parroquia.
- **Bitácora de auditoría:** PostgreSQL deniega `SELECT` directo a `authenticated`; no se incluyó como tabla de conteo RLS porque su denegación por GRANT es deliberada.
- **17 RPC SECURITY DEFINER** que no contienen una referencia textual directa a `auth.uid()` / `is_active` fueron cotejadas contra llamadas a validadores delegados. **17/17** tienen una ruta de comprobación detectable; por ejemplo, la digitalización histórica delega en una RPC interna sin `EXECUTE` para `authenticated`, que verifica identidad y propiedad parroquial. Es una **inspección preliminar de delegación**, no una certificación semántica de las **152 RPC** expuestas a autenticados.

## Resultados de la puerta de calidad
- **2.023 / 2.023** pruebas sintéticas.
- **30 / 30** comprobaciones de calidad.
- **18** regresiones V225 nuevas.
- Compilación Vite de producción, auditoría de dependencias y scripts históricos aprobados.
- Cero escritura, borrado, migración o cambio de permisos en QA.

## Entregables técnicos
- `AUDITORIA_RLS_IDENTIDADES_LIVE_V225.json`: síntesis sin UUID de personas ni contenidos sacramentales.
- `AUDITORIA_PERFIL_INEXISTENTE_LIVE_V225.json`: prueba real de ausencia de perfil activo.
- `AUDITORIA_RPC_DELEGACION_LIVE_V225.json`: nombres de las 17 RPC, huellas MD5 y controles delegados visibles; no contiene código de base, sujetos ni credenciales.
- `scripts/qa-role-matrix-readonly-v225.sql`: plantilla de ejecución futura segura por UUID ficticio, transacción READ ONLY y ROLLBACK.
- `scripts/test-live-rls-evidence-v225.mjs`: 18 pruebas de regresión estática de la evidencia actual, obligatorias en CI.
- `AUDITORIA_PUERTA_CALIDAD_V225.json` y `AUDITORIA_AVANCE_GLOBAL_V225.json`.

## Lo que **NO** prueban estos resultados
El establecimiento artificial de `authenticated` y del reclamo de JWT demuestra cómo las RLS procesan ese contexto **pero no autentica de verdad un dispositivo, no comprueba MFA ni entrega de correos, no ejerce interfaz con sesión real y no certifica las 152 RPC**. Las pruebas en CI validan el corte V225 de evidencia, no vuelven a consultar Supabase desde GitHub Actions.

## Bloqueadores antes del primer registro oficial
1. Resolver los grants predeterminados inseguros del ambiente futuro y revisar formalmente las RPC, el asesor de Auth y visibilidad GraphQL.
2. Pruebas E2E **realmente autenticadas** y reversibles de todos los roles, sacramentos, decretos, migración, notas, documentos, correo y respaldos.
3. Crear **proyecto Supabase nuevo e independiente, sin ningún dato QA**; verificar tablas, RLS, funciones, consecutivos y almacenamiento; acta de puesta en servicio.
4. Solo después, habilitar usuarios y partidas reales. El proyecto QA permanecerá separado como laboratorio; todos sus registros son ficticios y ninguno se convertirá en oficial.

## Porcentaje estimado
**93 %** (92,88 % ponderado y redondeado). El aumento se debe a pruebas de aislamiento RLS **ejecutadas de verdad en Supabase**, no a declarar listo el despliegue oficial. Los controles de arranque limpio permanecen vigentes y bloquean el modo oficial.
