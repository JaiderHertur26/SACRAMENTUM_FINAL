# SACRAMENTUM FINAL — CIERRE TÉCNICO V224 · SEGURIDAD DEL ARRANQUE

**Fecha de trabajo:** 26 de octubre de 2026 (Colombia; consultas registradas en UTC el día 27).
**Proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Resultado medido
- **2.005 / 2.005** pruebas sintéticas aprobadas; **30 / 30** verificaciones de calidad, compilación Vite y dependencias.
- **31 pruebas adicionales** sobre las 28 de V223, para **59** pruebas de publicación/seguridad en conjunto.
- **82 de 82** tablas públicas con RLS activo; **0** tablas con permiso `TRUNCATE` para los roles `authenticated` o `anon`; **0** claves foráneas sin validar.
- **244** funciones públicas, **207** SECURITY DEFINER, de las cuales **152** están disponibles a cuentas `authenticated`. **Ninguna** de estas funciones privilegiadas es invocable por `anon` según la consulta ejecutada.
- **17** de las 152 funciones no muestran un control de identidad por coincidencia textual simple; **esto no prueba una vulnerabilidad**, pues algunas delegan la comprobación a helpers. Se requiere revisión manual de lógica y permisos.
- Hallazgo pendiente importante: **8 grants predeterminados potencialmente peligrosos para futuras tablas** y **3 grants predeterminados de ejecución de funciones** en las ACL actuales. Las protecciones de los objetos existentes no neutralizan automáticamente esta configuración futura.
- El contexto SQL actual es `postgres`, **sin membresía en `supabase_admin`**. Las ACL por defecto correspondientes a este último rol no pueden modificarse de manera responsable desde esta sesión.
- El analizador de Supabase informa 5 tablas deliberadamente sin política, 64 advertencias de visibilidad GraphQL, 152 advertencias por RPC privilegiadas autenticadas y una advertencia por ausencia de protección contra contraseñas filtradas. Estos hallazgos deben revisarse por significado; no equivalen por sí solos a exposición efectiva de filas.

## Entrega V224
1. `scripts/release-security-preflight-v224.sql`: inventario SQL de **solo lectura** que examina RLS, ACL, privilegios de tablas actuales y por defecto, funciones SECURITY DEFINER, `search_path` y FKs.
2. `release-security-guard-v224.mjs`: nueva condición **fail-closed** para una eventual compilación `official`. Exige cero hallazgos críticos, inventario completo y revisión firmada procedimentalmente de las funciones accesibles. Los datos de la base QA **no** pueden satisfacer el control.
3. `release-guard-core-v223.mjs`: eleva el contrato de lanzamiento a **V224** y añade el análisis de seguridad; un certificado V223 antiguo ya no basta.
4. `scripts/test-release-security-preflight-v224.mjs`: 31 pruebas nuevas que cubren falsos certificados, ACL peligrosas, RLS, funciones, identidad y exclusiones de Vercel.
5. `AUDITORIA_SEGURIDAD_LIVE_QA_V224.json`: solo metadatos y agregados de la base QA; **sin nombres, archivos sacramentales ni secretos**.
6. Las nuevas pruebas están integradas a CI y al gate de auditoría local.

## Bloqueadores reales del uso oficial
- Corregir las ACL predeterminadas de futuros objetos bajo la cuenta administradora correspondiente y verificar de nuevo, sin romper grants de operaciones que el sistema requiere.
- Inspeccionar las **152 RPC SECURITY DEFINER** accesibles desde `authenticated`, empezando por las 17 que requieren revisión de delegación de identidad. Confirmar `search_path`, jurisdicción y revocación del acceso para funciones que no deban ser RPC externas.
- Revisar las advertencias del asesor SQL y la protección de contraseñas filtradas en Auth.
- Completar prueba real autenticada de extremo a extremo por roles y cuatro sacramentos, respaldos/restauración, correo y revisión física documental.
- Crear un **proyecto nuevo e independiente** para las primeras partidas reales, sin copiar ninguna cuenta, partida, historial, importación ni otra fila QA. Certificar la base vacía y la operación del nuevo entorno antes de dar validez oficial.

## Protección de datos de prueba
No se ha hecho ningún cambio de servidor en esta etapa. **Cero** `DELETE`, `TRUNCATE`, `UPDATE`, migraciones o limpieza de QA. La base actual es un laboratorio; ningún dato de ella se conservará en la futura instancia registral.

**Porcentaje:** el proyecto mantiene avance técnico estimado del **92 %**. Aunque la cobertura de controles ha crecido, todavía existen bloqueos verificables de seguridad, razón por la cual **no** se declara listo para entrar en operación oficial.

Fuentes de remediación de Supabase:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
