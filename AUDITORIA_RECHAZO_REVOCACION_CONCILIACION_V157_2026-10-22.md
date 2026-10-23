# SACRAMENTUM · V157 — RECHAZO Y REVOCACIÓN DE CONCILIACIONES

## Hallazgo
- La tabla later_note_reconciliations_v156 tenía estado rejected pero sin RPC ni acción UI para utilizarlo. Una solicitud obsoleta podía permanecer pendiente y bloquear nueva solicitud para igual decreto/nota.
- Diócesis no disponía de una forma auditada de denegar solicitud o retirar autorización antes de la ejecución.

## Corrección backend efectiva
- Migración 20261023032715_later_note_rejection_and_revocation_v157.sql aplicada al Supabase REGISTRO SACRAMENTOS.
- Función public.reject_later_note_reconciliation_v157: sólo perfil diocese activo de la diócesis de la solicitud, exige referencia documental de 8+ caracteres y motivo de 20+ caracteres, valida estado pending/authorized bajo FOR UPDATE, escribe rejected_by/reference/reason/at.
- No altera marginal_notes, decretos ni tablas sacramentales; no puede revocar un expediente ya executed. Conserva auditoría de rechazo y de revocación de aprobación.
- La restricción de unicidad vigente permite una nueva solicitud de la misma pareja decreto/nota tras rejected, sin borrar antecedentes.
- Función public.list_later_note_reconciliations_v157 consulta alcance de diócesis desde Cancillería y Diócesis y ofrece razón del rechazo; no concede SELECT/UPDATE directos de tabla a authenticated.

## Código frontend local
- src/pages/chancery/LaterNoteReconciliationPage.jsx: rechazo o revocación motivada por Diócesis con confirmación explícita, razones visibles y contador de rechazados.
- src/services/laterNoteReconciliationService.js actualiza listado a la nueva RPC v157 e invoca RPC rechazo. Cambiar UUID del decreto borra nota previamente seleccionada.
- Build producción pasó. No hubo despliegue web.

## QA efectivamente ejecutada en Supabase
- scripts/qa-rollback-later-note-rejection-v157.sql ejecutado en backend real con BEGIN/ROLLBACK. Usa SET LOCAL ROLE authenticated, sujeto ficticio y perfiles activos existentes para garantizar validación de permisos SQL.
- Confirma seis denegaciones: Parroquia, Cancillería, revocación ejecutable, rechazo duplicado, motivo insuficiente y actor sin perfil para listado.
- Diócesis rechazó caso pending, autorizó y luego revocó segundo caso autorizado, y se permitió tercera solicitud sin modificar nota ni decreto.
- Auditoría institucional distingue un rechazo de solicitud y una revocación de autorización. Residuos QA: cero decretos, notas, expedientes y registros de auditoría.
- Chrome headless con perfil temporal aislado cargó la ruta privada sin autenticación: mostró la vista pública y no expuso el formulario protegido. No se probó navegación autenticada de los dos roles.

## Cobertura y limitaciones
- 1029/1029 pruebas sintéticas, 28/28 checks de calidad, build y npm audit de producción+desarrollo sin hallazgos.
- Total SECURITY DEFINER 206 (197 public, 9 private), 145 ejecutables authenticated, 35 con QA parcial, 110 pendientes.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}, 20 controles complementados sin ascender estados.
- Sigue pendiente una prueba real con dos conexiones PostgreSQL simultáneas; la interfaz de Diócesis y Cancillería autenticadas no fue recorrida físicamente, y el frontend local aún no fue desplegado.

**Dictamen:** flujo negativo de decisiones institucionales real y reversible, auditado parcialmente en backend. Certificación integral abierta.
