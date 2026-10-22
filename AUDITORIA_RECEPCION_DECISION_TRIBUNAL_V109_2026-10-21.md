# SACRAMENTUM V109 · Recepción de decisiones atribuidas al Tribunal, sin autenticación ni ejecución automáticas

**Fecha:** 21 de octubre de 2026, Colombia. **Migración UTC:** `20261022014929_court_decision_receipt_unverified_v109.sql`.

## Decisión de arquitectura

La revisión jurídica iniciada en V107/V108 necesita distinguir cuatro hechos: solicitud de revisión, correspondencia del Tribunal, **recepción de una supuesta decisión judicial** y eventual ejecución de efectos registrales. V109 implementa exclusivamente la **recepción documental no verificada**. No se interpreta una referencia o una transcripción como resolución auténtica.

Se crea `public.nullity_court_decision_receipts`, ligada por FK al caso, sentencia original, diócesis y parroquia. Registra:
- Resultado **declarado** en la comunicación: mantiene nulidad, exige estudio adicional o afirma que procede rectificar.
- Autoridad **declarada** como emisora, referencia, fecha y descripción (mínimo 50 caracteres).
- Solicitante/usuario actor y fecha de registro.
- Estado invariable `unverified` y constancia `receipt_only_no_authenticity_or_effects`.
- Unicidad por caso y referencia de documento; índice de seguimiento.

No contiene ningún mecanismo de validación de autenticidad o ejecución jurídica. Los registros son append-only para usuarios autenticados: tabla con RLS, SELECT limitado por jurisdicción, sin permisos directos de INSERT/UPDATE/DELETE.

La RPC `register_nullity_court_decision_receipt_v109(uuid,text,text,text,date,text)` exige Cancillería activa, jurisdicción del caso, parroquia, decreto y Matrimonio concordantes, sentencia vigente, Matrimonio `nullified`, expediente `under_legal_review`, y al menos una constancia previa `start_review`. Bloquea el caso `FOR UPDATE`, rechaza fechas futuras, datos insuficientes y referencias repetidas. Su única escritura institucional es la constancia y un evento de auditoría. **No altera decreto, Matrimonio, Bautismos, notas ni acuses.**

## Interfaz

En Cancillería / Archivo / Tribunal:
- Acción **Registrar decisión recibida (sin verificar)** en expedientes en estudio.
- Registro guiado del resultado que aparenta declarar el oficio, autoridad, referencia, fecha y resumen.
- Confirmación clara que no autentica ni revoca.
- Historial persistente por caso con indicador **SIN VERIFICAR** y resumen; ningún botón de ejecución.

Diócesis y Parroquia solo ven el número de documentos recibidos **SIN VERIFICAR** de su ámbito, sin facultad de registro ni aprobación.

## Pruebas reales directas PostgreSQL

Se usaron Matrimonio, sentencia y expediente enteramente ficticios, creados en BEGIN y revertidos con ROLLBACK.
1. Roles Administrador General, Diócesis y Parroquia intentaron registrar recepción: **3/3 rechazados**.
2. Cancillería intentó recibir antes de iniciar estudio: **rechazado**.
3. Se inició estudio ficticio, Cancillería registró comunicación declarada de posible rectificación, con estado `unverified`.
4. Registro duplicado para la misma referencia: **rechazado**.
5. La sentencia original quedó `active`, Matrimonio `nullified`, expediente `under_legal_review`.
6. Comprobación de lectura RLS: Administrador General 0, Diócesis 1, Cancillería 1 y Parroquia titular 1.
7. La primera prueba creó una constancia y un evento de auditoría dentro de la transacción.
8. Postcondiciones SQL verificadas: **0 documentos de decisión persistidos, 0 expedientes de revisión, 0 decretos QA, 0 Matrimonios QA y 0 auditorías de recepción**.
9. Privilegios reales: usuario autenticado INSERT=false y UPDATE=false; anon SELECT=false y EXECUTE=false.

## Regresión

Se agregaron **26 pruebas sintéticas permanentes** en `scripts/test-court-decision-receipt-v109.mjs`, incluidas en `scripts/audit-gate-v90.mjs` y GitHub Actions. Batería acumulada esperada: **407 pruebas sintéticas** (381 de V108 + 26 V109), junto a 23 verificadores históricos y compilación de producción.

## Limitaciones y riesgos que siguen abiertos

- La plataforma NO comprueba criptográficamente firmas de decisiones judiciales, autenticidad material, jurisdicción canónica del Tribunal ni cadena de custodia de un archivo físico. Los campos son referencias introducidas por Cancillería, no prueba de verdad jurídica.
- No se permite aplicar la supuesta decisión. Cualquier autorización ulterior debe exigir decisión competente verificable, control institucional adicional, plan completo de notificaciones correctivas, preservación de notas originales y ensayo de rollback/restauración.
- No se completaron pruebas E2E visuales de sesiones autenticadas, escenarios concurrentes entre dos Parroquias ni restore en base separada. Actualmente solo hay un usuario parroquial activo.
- Cinco HIGH de dependencias npm sin resolver: la puerta de seguridad debe permanecer en FAIL. Supabase mantiene avisos de SECURITY DEFINER y objetos GraphQL que requieren evaluación individual.

**Criterio de aceptación:** registrar recepción ≠ verificar autenticidad ≠ ejecutar efectos registrales. Estas fases no deben confluir.
