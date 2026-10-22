# SACRAMENTUM · AUTORIDAD DE NOTAS MARGINALES Y ACUSES OFICIALES · V133

## Fallos reales reproducidos con ROLLBACK antes de la corrección
- Administrador General ejecutó create_manual_marginal_note sobre un Matrimonio ficticio, a pesar de que el rol no puede alterar los libros sacramentales.
- Diócesis ejecutó mark_official_notification_read sobre una comunicación ficticia destinada a Parroquia y generó status=read/read_at indebidamente.
- Las dos reproducciones finalizaron con excepción intencional y ROLLBACK, sin alterar libros reales.

## Corrección aplicada en Supabase
- Migración: supabase/migrations/20261022155208_separate_marginal_note_and_notification_receipt_authority_v133.sql, registrada con la misma versión en el proyecto.
- create_manual_marginal_note: solo Parroquia de su propio archivo o Cancillería dentro de su diócesis; no se permitió al Administrador General ni Diócesis. print_policy=required sigue prohibida a Parroquia.
- mark_official_notification_read: únicamente Parroquia receptora puede transformar una comunicación en leída. Cancillería, Diócesis y Administrador General no suplantan recepción.
- archive_official_notification: únicamente Parroquia destinataria puede archivar el aviso; se elimina la excepción heredada para Administrador General.
- No se alteraron permisos generales de lectura ni las políticas RLS de supervisión, que son distintas de la potestad de modificar el estado de recepción.

## Matrices ejecutadas y reversibles
- scripts/qa-rollback-marginal-note-notification-matrix-v133.sql: 4 roles, 8 denegaciones, 2 notas legítimas y 2 transiciones legítimas de aviso (lectura y archivo). PASS.
- scripts/qa-rollback-cross-parish-notes-receipts-v133.sql: una parroquia contra otra parroquia falsa en la misma diócesis; 3 denegaciones, ningún aviso ni nota ajena cambiados. PASS.
- Se verificó que el cliente authenticated carece de INSERT directo en marginal_notes y UPDATE directo en official_notifications.
- Resultado de residuo SQL: 0 matrimonios QA, 0 avisos oficiales QA, 0 notas QA, 0 parroquias QA. Archivo ANULACION 5 pending y 2 linked sin alterar.

## Regresión continua y auditoría
- scripts/test-marginal-receipt-authority-v133.mjs: 13 pruebas estáticas/contractuales añadidas al gate y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V133.json: 621 tests sintéticos aprobados, 28/28 verificaciones, build, CSS y npm audit runtime/completo 0 vulnerabilidades.
- AUDITORIA_RPC_PRIVILEGIADAS_V133.json: 136 RPC SECURITY DEFINER ejecutables por authenticated, 13 parcialmente verificadas y 123 pendientes sin revisión individual exhaustiva.

## Límites de evidencia
- Se usaron actores existentes y entidades enteramente falsas sólo dentro de BEGIN/ROLLBACK. No se inició sesión interactiva real en Chrome.
- No se publicaron cambios de frontend ni se implementó prueba real de impresión o de tratamiento de archivos auténticos.
- Las RPC con pruebas parciales no son equivalentes a aprobación completa de la seguridad del sistema.

## Plan maestro
- Se agregaron evidencias específicas a 17 controles. Estado de 325: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

**Dictamen:** cerrada la suplantación del acto de lectura parroquial y el asiento manual no autorizado por Administrador General. Auditoría integral continúa.
