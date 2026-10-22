# SACRAMENTUM V110 · Auditoría de doble cotejo documental sobre decisiones atribuidas al Tribunal

**Fecha:** 21 de octubre de 2026, Colombia. **Migración UTC:** `20261022020721_dual_control_court_receipt_review_v110.sql`. **Ámbito:** recepción judicial aún no verificada de V109; Cancillería y Diócesis de la misma jurisdicción.

## Riesgo y diseño

La V109 registra documentos atribuibles al Tribunal con `verification_state=unverified`. Es insuficiente que quien recibió un oficio pueda declarar individualmente que su referencia es válida. Se incorporó **segregación de funciones para cotejo interno**:
- **Primera actuación:** Cancillería de la diócesis registra comprobación de referencia con canal oficial identificado y constancia externa.
- **Segunda actuación:** Diócesis revisa independientemente después de Cancillería, con usuario distinto del primero y también distinto del receptor de V109.
- Ambas actuaciones admiten `reference_matches`, `requires_clarification` o `discrepancy_detected`. La discrepancia se conserva íntegra; no prevalece automáticamente una opinión.
- **Aunque las dos coincidieran, la sentencia sigue `unverified`: dos testimonios internos no certifican por sí mismos la autenticidad del documento judicial.**

La V110 **no constituye aprobación de tribunal, validación de firma, sentencia ejecutoria, autorización de revocación o cambio registral**.

## Implementación de base

La tabla `public.nullity_court_receipt_checks` guarda recepción, caso, jurisdicción, etapa, hallazgo, canal de contacto, referencia del contraste (mínimo 12 caracteres), fecha no futura, explicación (mínimo 40 caracteres), actor y fecha real de asiento. Un índice único `(receipt_id,stage)` impide duplicados.

- RLS activa; SELECT por Cancillería y Diócesis de la jurisdicción, o Parroquia propietaria, sin acceso de Administrador General.
- `authenticated` no puede insertar, actualizar o borrar directamente.
- RPC `public.record_court_receipt_independent_check_v110` SECURITY DEFINER validada internamente: sesión activa, rol permitido, jurisdicción cruzada de recepción/caso/sentencia/parroquia, nulidad vigente, revisión en estudio y orden estricto.
- Bloqueo `FOR UPDATE` de la recepción y unique por etapa para proteger contra dos escrituras simultáneas.
- Auditoría con `original_document_still_unverified=true`, `authenticity_certified=false` y `registral_effects_executed=false`.
- Ninguna instrucción modifica decretos, Matrimonios, Bautismos, notas marginales, avisos, acuses o la condición `unverified` de la recepción.

## Pruebas conductuales PostgreSQL con transacciones reversibles

**Escenario 1, desacuerdo:** se crearon Matrimonio, sentencia y expediente ficticios; Admin General y Parroquia fueron rechazados para escribir; Diócesis antes de Cancillería fue rechazada; Cancillería registró referencia concordante y Diócesis exigió aclaración. Se rechazaron segundas actuaciones duplicadas de ambos roles. Quedaron **dos identidades de actor distintas**, dos eventos de auditoría, la decisión `unverified`, sentencia `active` y Matrimonio `nullified`. Todo terminó con `ROLLBACK`.

**Escenario 2, coincidencia:** ambos usuarios registraron `reference_matches`; la lectura RLS resultó Admin General = 0, Diócesis = 2, Cancillería = 2, Parroquia propietaria = 2. La decisión conservó el estado `unverified` y todos los efectos originales; la transacción terminó en `ROLLBACK`.

**Postcondición persistente:** 0 cotejos V110, 0 recepciones V109, 0 expedientes de revisión, 0 decretos y Matrimonios QA, 0 eventos de auditoría sintéticos. Privilegios reales: `authenticated INSERT=false`, `UPDATE=false`; `anon SELECT=false`, `EXECUTE=false`.

## Interfaz institucional

Servicio común `src/services/nullityReceiptDualControl.js` con formulario de hallazgo, medio, referencia, fecha y explicación; confirmación que el resultado no certifica autenticidad ni cambia partidas.

- Cancillería: acción **Registrar cotejo de Cancillería** en documentos recibidos, indicador del resultado y de contraste de Diócesis pendiente/realizado.
- Diócesis: en detalle del decreto, identifica cada recepción y permite **Registrar contraste independiente de Diócesis** únicamente cuando ya existe cotejo previo, sin función de aprobar o ejecutar una sentencia.
- Parroquia conserva visibilidad informativa previa, sin permiso para escribir estos cotejos.

## Regresión y límites

- Nuevo `scripts/test-dual-control-court-receipts-v110.mjs`: **28 pruebas sintéticas** de estructura, orden, roles, integridad, UI y no ejecución.
- Batería acumulada esperada: **435 pruebas sintéticas** (407 V109 + 28 V110), más 23 verificadores históricos y build Vite.
- Sin ensayo visual completo con credenciales reales, sin dos parroquias activas distintas, sin restauración aislada de respaldo ni concurrencia de dos procesos externos simultáneos. El bloqueo FOR UPDATE es una protección diseñada y examinada, no una carga paralela real ya certificada.
- La autenticidad judicial real y cualquier efecto posterior requieren comprobación documental externa independiente y procedimiento institucional específico que todavía NO existe.
- Las cinco alertas HIGH de dependencias siguen abiertas y deben mantener la puerta de seguridad en fallo.
