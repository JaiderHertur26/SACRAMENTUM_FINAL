# SACRAMENTUM V105 · Auditoría de nulidad matrimonial y vínculo con Bautismos

**Fecha local:** 21 de octubre de 2026 (Colombia). **Migración UTC:** `20261022002722_verify_nullity_baptism_identity_v105.sql`. **Nivel de gravedad:** crítico para integridad de partidas sacramentales. **Estado:** corrección desplegada en Supabase, pruebas de comportamiento realizadas con datos ficticios y reversibles.

## Riesgo comprobado antes de la corrección

La función privilegiada `public.apply_marriage_nullity`, exclusiva de Cancillería desde V104, aceptaba `p_baptism_ids` y únicamente comprobaba que cada Bautismo estuviera vigente y perteneciera a la diócesis del Matrimonio.

**No comprobaba que el Bautismo correspondiera al novio o a la novia.**

En una transacción `BEGIN/ROLLBACK` se crearon un Matrimonio ficticio de dos contrayentes y un Bautismo ficticio de la persona totalmente distinta «PERSONA AJENA NO RELACIONADA». La RPC registró la nulidad y añadió a esa partida bautismal una **nota marginal de nulidad matrimonial** sin vínculo con los contrayentes. El ensayo terminó en `ROLLBACK`; ninguna partida histórica se utilizó ni modificó para demostrarlo.

Este hallazgo significa que un identificador bautismal incorrecto podía afectar un expediente sacramental ajeno, incluso aunque el usuario tuviera competencia sobre la diócesis.

## Corrección técnica V105

Migración `supabase/migrations/20261022002722_verify_nullity_baptism_identity_v105.sql`, aplicada con éxito en Supabase.

Se añadieron tres helpers `SECURITY INVOKER` en esquema interno `private` y se revocó `EXECUTE` de PUBLIC, anon y authenticated:

- `private.person_name_normalized_v105(text)`: compara nombres y apellidos con normalización conservadora de tildes, mayúsculas y espacios.
- `private.registry_ref_normalized_v105(text)`: compara libro, folio y número conservando identificadores alfanuméricos, pero normalizando ceros iniciales numéricos.
- `private.assert_nullity_baptism_link_v105(uuid,uuid)`: exige coincidencia del nombre y apellido del Bautizado con **uno de los contrayentes** y coincidencia de **libro, folio y número** entre el Matrimonio y la partida bautismal.

El control se insertó en la función `apply_marriage_nullity` **antes de escribir una nota bautismal local o generar una notificación remota**. Se admiten como máximo dos identificadores de Bautismo, sin duplicados ni nulos.

Cuando falte información de identidad o coordenadas, la vinculación bautismal automática **se rechaza**, evitando una nota dudosa. Es posible registrar la nulidad en el Matrimonio sin `p_baptism_ids`, y completar posteriormente el cotejo documental mediante un proceso institucional que aún debe auditarse. La validación técnica no sustituye la identidad canónica de los documentos físicos ni la revisión de una sentencia auténtica.

La migración es fail-closed respecto de la versión del cuerpo SQL y no altera registros existentes.

## Pruebas de comportamiento en Supabase

Todos los registros fueron creados exclusivamente para pruebas y eliminados por ROLLBACK.

| Escenario | Resultado |
|---|---|
| Asociar Bautismo de persona totalmente ajena | **Rechazado**; Matrimonio no se anula, cero notas |
| Identidad y coordenadas verificadas de contrayente masculino, parroquia local | **Permitido**; una nota marginal |
| Identidad y coordenadas verificadas de contrayente femenino, parroquia distinta pero misma diócesis | **Permitido**; una notificación y un destinatario pendiente |
| Libro 0007 versus 7, folio 0008 versus 8 y número 0009 versus 9 | Normalización correcta |
| Enviar el mismo Bautismo dos veces | **Rechazado** |
| Intentar vínculo con coordenadas ausentes en el Matrimonio | **Rechazado** |
| Declarar nulidad matrimonial sin vínculos bautismales automáticos | **Permitido**, sin propagación a Bautismos |

Las comprobaciones verificaron que el Matrimonio se marca `nullified` en el caso legítimo, la nota local se crea una sola vez y la notificación remota queda pendiente para aceptación por la parroquia receptora; no se altera directamente el Bautismo remoto sin aceptación.

**Postcondición real de producción:** cero Bautismos, cero Matrimonios, cero decretos, cero notificaciones, cero notas marginales y cero eventos de auditoría con marcadores QA-V105; la RPC protegida está activa y el helper de autoridad no es ejecutable directamente por authenticated.

## Regresión automatizada

Nuevo `scripts/test-nullity-baptism-link-v105.mjs`: 12 pruebas estáticas sobre cotejo, referencias y nombres, falta de datos, restricciones de array, permisos de helpers, seguridad de transacción y adaptación fail-closed. Integrado a la puerta de calidad y a GitHub Actions.

Batería acumulada esperada **325/325 pruebas sintéticas** (313 de V104 + 12 de V105), distinta de los **325 controles** de la auditoría maestra: son métricas de naturaleza diferente.

## Límites expresamente abiertos

- Un cotejo de nombre y coordenadas es una condición técnica fuerte pero **no constituye por sí mismo una certificación jurídica o identidad irrefutable**. La existencia de homónimos o errores históricos exige cotejo documental.
- No se ensayó aún una sentencia auténtica del Tribunal Eclesiástico, ni se definió un procedimiento integral de conciliación y corrección posterior de vínculos con datos históricos incompletos.
- Falta validar la aceptación remota y la conversión del aviso en nota marginal en la parroquia receptora con sesiones autenticadas de interfaz.
- Falta repetir la matriz de doble diócesis y concurrencia, recuperar backups completos en laboratorio y revisar las demás funciones privilegiadas.
- Las cinco alertas HIGH de dependencias siguen abiertas y no deben ocultarse relajando el criterio de CI.

**Criterio:** la integridad sacramental prevalece sobre la automatización. Si no se puede probar la correspondencia del Bautismo, no se añade la nota ni se envía notificación.
