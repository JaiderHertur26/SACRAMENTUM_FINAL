# SACRAMENTUM V321 · Cierre seguro de pendientes preoperacionales
**Fecha:** 29 de octubre de 2026, Colombia.
**Supabase:** `foczofcmwampjvlfbsqn`. Los datos de la instancia siguen siendo de prueba.

## 1. Vulnerabilidad concreta corregida
La función `public.next_sacramental_case_sequence_v318(uuid,text)` podía ser llamada directamente desde cualquier sesión parroquial autenticada que superara sus guardas. Eso permitía consumir números de documentos NM/NCF sin generar la correspondencia sacramental, causando huecos en la secuencia.

Migración aplicada: `supabase/deployment/v321_lock_internal_notification_sequence.sql`, que **revoca EXECUTE a authenticated** para ese helper, sin cambiar el contrato ni el acceso del emisor válido `issue_sacramental_case_v277` (SECURITY DEFINER de propietario postgres).
- Verificación SQL `scripts/qa-rollback-internal-numbering-privilege-v321.sql`: `direct_sequence_denied=true`, `valid_issuance_rpc_preserved=true`, `rollback=true`.
- Emisión matrimonial entre tres parroquias después de la revocación: `complete=true`, dos notificaciones y notas independientes, sin duplicados, `rollback=true`.
- Emisión combinada de Matrimonio y Confirmación V318: aprobada, sin colisión de numeración, con reversión.
- Privacidad RLS V320: las dos parroquias, Cancillería y Diócesis mantienen las restricciones correctas, `rollback=true`.
- Supabase Security Advisor: el total de funciones SECURITY DEFINER accesibles a `authenticated` bajó de 173 a **172**; permisos anónimos sobre estas funciones continúan en cero.

## 2. Preflight de inicio oficial ejecutado, solo lectura
Archivo `scripts/read-only-v321-official-readiness.sql`, revisado para no tener instrucciones de escritura, DDL ni grants.
**Resultado:** `BLOQUEADO_HASTA_CIERRE_INSTITUCIONAL`, por:
- 8.393 registros sacramentales de prueba y dos decretos todavía presentes.
- 4 parroquias operativas, pero 1 con cuenta parroquial real activa.
- 0 memorias de libros y 0 asientos nuevos en el ledger privado.
- 0 de 26 revisiones de maestros institucionales firmadas.
- No existen las constancias V268 de limpieza respaldada/restaurada ni la V267 de inicio oficial.
El mismo preflight verificó que las cuentas institucionales activas no tienen identidad Auth inexistente, identidad duplicada ni jurisdicción parroquial incoherente. Ninguna identidad ficticia quedó persistente.

Las 56 tablas transaccionales a limpiar no deben purgarse unilateralmente: ya existe un procedimiento V268 que exige respaldo y restauración verificables, y el V267 no habilita libros hasta completar dos revisiones de las 26 tablas maestras. **No se hizo limpieza** en V321.

## 3. Contraseñas filtradas en plan Free
Se verificó directamente el plan real de la organización Supabase: `free`. La opción Supabase Auth **Leaked Password Protection** requiere Pro o superior, como documenta https://supabase.com/docs/guides/auth/password-security. Su habilitación supondría una decisión de facturación y no fue realizada.

Se ensayó una política de contraseñas más fuertes para la interfaz y para `activate-environment`, pero la publicación de la Edge Function fue bloqueada por los controles disponibles y la puerta V227 exigió una nueva aceptación real con navegador autenticado tras tocar los componentes de recuperación. Para no publicar un cliente y un servidor con validaciones inconsistentes **se revirtieron esos cambios experimentales del código de acceso**. No se afirma que la protección contra filtraciones o la política de 12 caracteres estén activas en producción.

## 4. Avisos residuales y su tratamiento
- **172 advertencias de funciones SECURITY DEFINER accesibles por authenticated:** siguen siendo RPCs deliberadamente expuestos para funciones institucionales y deben revisarse individualmente. No se revocan ni convierten masivamente a SECURITY INVOKER porque romperían los flujos y permisos legítimos; el helper de numeración identificado como riesgoso sí fue restringido.
- **17 tablas public con RLS y sin políticas (INFO):** se verificó antes que las tablas cerradas no conceden SELECT a anon/authenticated; no se añadió una política permisiva para quitar avisos.
- **82 índices señalados sin historial de uso (INFO):** no se borran índices nuevos o de soporte sin observación de carga real. **0** avisos de RLS initplan y **0** FKs sin índices siguen resueltos desde V320.

## 5. Validación y publicación
- Pruebas V321 `scripts/test-v321-hardening.mjs`: **4/4 aprobadas**.
- Regresión de pruebas previas V227 con huellas originales de Auth: aprobadas después de revertir cambios no publicados.
- `npm run audit:master`: **30/30 verificaciones aprobadas**, compilación y dependencias incluidas.
- Se actualizó la lista de pruebas tanto en `scripts/audit-gate-v90.mjs` como en GitHub Actions.
- Conteos postensayo intactos: **5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 2 decretos, 82 notas marginales, 0 nuevas notificaciones matrimoniales de prueba.**

## 6. Procedimiento humano restante para operar oficialmente
1. Determinar con responsables de Arquidiócesis las cuentas legítimas parroquiales y su vinculación real; no crear identidades falsas ni otorgar permisos anticipados.
2. Validar maestros, dos firmantes, backup verificable y limpieza con protocolos V268/V273.
3. Aplicar apertura transaccional V267 y crear libros con los RPC habilitados tras el cierre oficial.
4. Para el aviso de contraseñas filtradas, optar formalmente por Supabase Pro o aceptar la limitación del plan Free y evaluar controles compensatorios.
5. Continuar auditoría individual de 172 RPC privilegiados y pruebas externas con cuentas reales, sin rebajar controles.

**No se declara el 100 % ni cero advertencias. La publicación V321 solo incorpora el endurecimiento del consecutivo y las pruebas/preflight sin modificar registros.**
