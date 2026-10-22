# SACRAMENTUM V106 · Auditoría de recepción de notificaciones de nulidad matrimonial

**Fecha:** 21 de octubre de 2026 (Colombia; migración sellada en UTC del 22 de octubre). **Proyecto Supabase:** REGISTRO SACRAMENTOS. **Severidad:** alta, con impacto potencial en integridad de partidas bautismales y trazabilidad jurídica. **Entorno de prueba:** transacciones ficticias reversibles en la base existente.

## Dos defectos reproducidos

Se examinó `public.process_matrimonial_notification_recipient(uuid)`, función `SECURITY DEFINER` utilizada al aceptar avisos sacramentales desde la bandeja de Parroquia. Antes de V106:
1. Una notificación `nulidad_matrimonial` sin decreto válido en `public.decretos` podía recibirse y colocar una nota de nulidad en un Bautismo. El receptor no cotejaba su sentencia, Matrimonio y vínculo bautismal.
2. `public.archive_matrimonial_notification_recipient(uuid)` permitía cambiar a `cancelled` un aviso previamente `processed` cuya `note_applied` ya era `true`, contradiciendo el asiento generado.

**Reproducción real anterior:** se creó un Bautismo, documento y destinatario ficticios de una diócesis, con un `decreeId` UUID inexistente y una nota explícitamente de prueba. Una sesión autorizada de la Parroquia receptora aceptó el aviso. La nota se insertó en `marginal_notes`, `note_applied=true` y la llamada posterior de archivo cambió el estado a `cancelled`. Todo terminó en `ROLLBACK`, con cero datos persistidos.

## Corrección V106 en servidor

Migración aplicada:
`supabase/migrations/20261022004255_require_valid_nullity_notice_before_receipt_v106.sql`.

Las funciones mantienen firmas, permisos, control territorial e historial previos; se insertaron validaciones adicionales antes de escribir datos.

**Al procesar notificaciones:**
- Se rechaza un documento de origen cancelado o revertido.
- Si es nulidad matrimonial, se exige una sentencia/decreto UUID auténtico, tipo `nulidad_matrimonial`, sacramento Matrimonio y estado `active` o `vigente`.
- Decreto, Matrimonio, parroquia emisora y números de sentencia del documento y del destinatario deben corresponder exactamente.
- El Bautismo destinatario debe ser el mismo que figura en el documento de salida, debe constar en `decretos.payload.baptismIds` y debe superar nuevamente el cotejo de identidad y libro/folio/número establecido por V105.
- Si falla una comprobación, se rechaza la recepción y se conserva `pending`; no se genera ninguna nota marginal.

**Al archivar:**
- Está prohibido cancelar un aviso ya procesado, con nota aplicada o con acuse emitido.
- Archivar de nuevo uno ya cancelado es idempotente y no cambia el historial.

Las tablas de notificaciones no conceden INSERT ni UPDATE directo a `authenticated`; estas operaciones pasan por las RPC privilegiadas controladas.

## Casos conductuales posteriores

| Escenario ficticio | Resultado |
|---|---|
| Aceptar nulidad con decreto inexistente | Rechazado, 0 notas, destinatario sigue pendiente |
| Aceptar documento matrimonial de origen ya cancelado | Rechazado, 0 notas |
| Cancillería emite nulidad auténtica ficticia con Matrimonio y Bautismo verificables de dos parroquias | Decreto y aviso generados |
| Parroquia receptora marca aviso como leído y lo procesa | Permitido |
| Procesar una segunda vez el mismo destinatario | Idempotente, una sola nota |
| Confirmar asiento en Bautismo y acuse de recibido | Una nota marginal y un acuse |
| Archivar como cancelada la recepción ya aceptada | Rechazado; permanece `processed` |
| Certificación física como alternativa para nulidad | No admitida por el procedimiento físico, que solo permite Matrimonio/Confirmación |

El flujo positivo se ejecutó **completo**, comprobando una sola nota marginal, la emisión del acuse, la segunda aceptación idempotente y la denegación de archivo posterior. La reversión transaccional se realizó al final.

**Postcondiciones:** cero Bautismos, Matrimonios, decretos, avisos, notas marginales y eventos de auditoría QA-V106 persistidos; definiciones de las dos funciones corregidas activas.

## Automatización

- `scripts/test-nullity-receipt-authority-v106.mjs`: 14 nuevas pruebas de estructura, autorización, cotejo, estados, protección del acuse y diseño fail-closed.
- Integración en `scripts/audit-gate-v90.mjs` y `.github/workflows/sacramentum-auditoria-v90.yml`.
- Total acumulado esperado: **339 pruebas sintéticas** (325 V105 + 14 V106), adicionales a los 23 verificadores históricos y al build.
- Los 339 tests no se confunden con los 325 controles del plan maestro de auditoría.

## Límites pendientes

- La validez jurídica de una sentencia requiere cotejo con el expediente y el tribunal auténticos; la base comprueba correspondencia estructural, no la autenticidad extrínseca de un documento.
- No se ha realizado navegación autenticada exhaustiva por cada pantalla ni pruebas de dos sesiones paralelas de dos parroquias.
- Siguen pendientes reversiones jurídicas posteriores a acuses ya emitidos, corrección de expedientes históricos sin datos suficientes, restauración de respaldo aislada y el resto de las RPC privilegiadas.
- Las cinco alertas HIGH de npm siguen abiertas y deben resolverse con pruebas visuales y funcionales, sin desactivar el criterio de seguridad.

**Resultado:** dos fallos reproducidos, corregidos y comprobados con solicitudes SQL autenticadas y transacciones reversibles. La auditoría integral del sistema permanece abierta.
