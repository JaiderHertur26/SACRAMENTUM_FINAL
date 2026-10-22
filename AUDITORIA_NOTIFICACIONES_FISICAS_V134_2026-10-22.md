# SACRAMENTUM · SEGURIDAD DE NOTIFICACIONES FÍSICAS V134 Y PRUEBA DIGITAL V135

## Hallazgo real y protección aplicada
- Se reprodujo en SQL que process_manual_matrimonial_notification_physical permitía certificar un aviso con documento original cancelled, marcando recipient processed y note_applied true. La transacción lanzó excepción intencional y ROLLBACK.
- Supabase versión de migración 20261022160304: sólo destinatario pending/read, bloquea documento cancelled/reversed/revertida/archived/anulada/annulled, y exige diócesis de origen concordante.
- El documento se lee FOR SHARE para validar su estado antes de afectar una recepción. No se proclama protección completa contra toda carrera concurrente.
- Se mantienen funcionalidades correctas de Matrimonio y Confirmación física, con procesamiento idempotente y bitácora única.

## Verificación de defensa digital existente
- V135 no identificó otra vulnerabilidad. Un trigger anterior, sacramentum_guard_manual_recipient_processing, ya rechaza procesar digitalmente sin Bautismo vinculado ni certificación del asiento físico. Se añadió QA de no regresión, sin alterar función protegida.

## Evidencia reversible
- scripts/qa-rollback-physical-notification-cancelled-baseline-v134.sql: reproducción del defecto pre-migración.
- scripts/qa-rollback-physical-notification-source-status-v134.sql: cinco estados inválidos, uno vigente, rechazo de rol diocesano, reintento idempotente.
- scripts/qa-rollback-physical-notification-scope-v134.sql: origen de diócesis ajena y recipient archived rechazados.
- scripts/qa-rollback-physical-confirmation-source-v134.sql: Confirmación física cancelada rechazada y vigente aceptada.
- scripts/qa-rollback-digital-notification-unlinked-baseline-v135.sql: trigger digital preexistente rechaza acción sin vinculación ni certificación física.
- Todas las pruebas insertaron filas exclusivamente en BEGIN/ROLLBACK. Consulta final: cero notificaciones QA, cero destinatarios QA y cero diócesis ficticias. ANULACION sigue cinco pendientes y dos vinculados.

## Regresión y controles
- scripts/test-physical-notification-guard-v134.mjs: 18 tests nuevos integrados en puerta de calidad y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V134.json: 639 tests sintéticos aprobados, 28/28 controles estrictos, npm audit completo y producción 0 vulnerabilidades.
- AUDITORIA_RPC_PRIVILEGIADAS_V134.json: 136 RPC privilegiadas autorizadas para authenticated; 15 parcialmente comprobadas y 121 todavía sin revisión individual exhaustiva.
- Plan maestro: 17 controles con evidencia nueva. Estado global {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. No se certifican áreas enteras basándose en QA parcial.

## Limitaciones
- Pruebas de autorización con rol autenticado simulado en una transacción de Supabase; no son pruebas reales E2E de navegador con usuarios institucionales.
- Falta ensayo multisesión de concurrencia, respaldo/impresión y verificación física de documentos auténticos.
- Backend corregido; frontend sigue en rama de auditoría, sin desplegar cambios nuevos.

**Dictamen:** certificación física improcedente de notificaciones canceladas corregida; protección digital preexistente verificada.
