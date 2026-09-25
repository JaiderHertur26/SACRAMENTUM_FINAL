import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, ok) => {
  checks.push({ name, ok: Boolean(ok) });
  if (!ok) console.error('✗', name);
  else console.log('✓', name);
};

const sql = read('supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_ROBUSTA_V16.sql');
const service = read('src/services/matrimonialNotificationsService.js');
const form = read('src/components/FormularioNotificacionMatrimonial.jsx');
const manual = read('src/components/FormularioNotificacionManual.jsx');
const page = read('src/pages/parish/NotificacionMatrimonialPage.jsx');
const inbox = read('src/pages/parish/SacramentalNotificationsPage.jsx');
const sidebar = read('src/components/Sidebar.jsx');
const table = read('src/components/TablaRespaldos.jsx');
const filters = read('src/components/FiltrosRespaldos.jsx');
const confirm = read('src/components/ConfirmacionNotificacion.jsx');
const validation = read('src/utils/matrimonialNotificationValidation.js');
const docModal = read('src/components/ModalVerDocumento.jsx');
const printBackup = read('src/components/VistaImprimibleDocumentoRespaldo.jsx');
const incomingModal = read('src/components/ModalVerAviso.jsx');
const incomingPrint = read('src/components/VistaImprimibleDocumento.jsx');

check('V16 SQL: política RLS documentos', sql.includes('matrimonial_notifications_select_scoped'));
check('V16 SQL: política RLS destinatarios', sql.includes('matrimonial_recipients_select_scoped'));
check('V16 SQL: Realtime documentos', sql.includes("alter publication supabase_realtime add table public.matrimonial_notifications"));
check('V16 SQL: Realtime destinatarios', sql.includes("alter publication supabase_realtime add table public.matrimonial_notification_recipients"));
check('V16 SQL: bloqueo de updates directos', sql.includes('revoke insert,update,delete on public.matrimonial_notifications from anon,authenticated'));
check('V16 SQL: duplicado simétrico', sql.includes('least(source_baptism_id,spouse_baptism_id)') && sql.includes('greatest(source_baptism_id,spouse_baptism_id)'));
check('V16 SQL: origen matrimonial forzado', sql.includes('La parroquia emisora debe ser la parroquia donde consta el matrimonio'));
check('V16 SQL: fecha futura bloqueada', sql.includes('La fecha de matrimonio no puede estar en el futuro'));
check('V16 SQL: localizador manual obligatorio', sql.includes('Libro, folio y número de Bautismo son obligatorios en notificación manual'));
check('V16 SQL: snapshots de Bautismo', sql.includes("'sourceBaptism'") && sql.includes("'spouseBaptism'"));
check('V16 SQL: snapshots de notas', sql.includes("'mainMarginalNote',p_main_note") && sql.includes("'spouseMarginalNote',p_spouse_note"));
check('V16 SQL: snapshot autoridad', sql.includes("'issuerAuthority',v_issuer_authority"));
check('V16 SQL: vínculo marriage_id', sql.includes('marriageRecordLinked') && sql.includes('v_marriage_id'));
check('V16 SQL: cancelación después de efectos bloqueada', sql.includes('La notificación ya produjo efectos sacramentales o fue aceptada; no puede cancelarse'));

check('Servicio: mapea snapshots bautismales', service.includes('baptismSnapshot: sourceBaptism') && service.includes('spouseBaptismSnapshot: spouseBaptism'));
check('Servicio: documento específico por destinatario', service.includes('recipientPartyRole: partyRole') && service.includes("partyRole === 'conyuge'"));
check('Servicio: texto marginal específico receptor', service.includes('recipientPayload.marginalNote || mapped.marginNoteText'));
check('Servicio: estados de workflow', service.includes("workflowStatus = 'partial'") && service.includes("workflowStatus = 'received'"));
check('Servicio: cancelación visible sólo antes de efectos', service.includes('canCancel:') && service.includes('localNotesApplied === 0'));
check('Servicio: suscripción Realtime', service.includes('subscribeToSacramentalNotificationActivity') && service.includes("'postgres_changes'"));

check('Formulario digital: mismo Bautismo bloqueado', form.includes('Los dos contrayentes no pueden utilizar la misma partida de Bautismo'));
check('Formulario digital: origen emisor fijo', form.includes('marriageParish: senderParishId') && form.includes('marriageDiocese: senderDioceseId'));
check('Formulario digital: bloqueo duplicado por expediente', form.includes('validarNotificacionMatrimonialDuplicada'));
check('Formulario digital: doble envío bloqueado', form.includes('if (disabled) return') && form.includes('disabled={!isFormValid || disabled}'));
check('Validador: ya no existe bloqueo por cónyuge/nombre', !validation.includes('validarPersonaNoTieneConyuge'));

check('Formulario manual: Libro Bautismo obligatorio', manual.includes("'libroBautismo'") && manual.includes("'folioBautismo'") && manual.includes("'numeroBautismo'"));
check('Formulario manual: fecha futura bloqueada', manual.includes('La fecha de matrimonio no puede estar en el futuro'));

check('Página emisión: Realtime activo', page.includes('subscribeToSacramentalNotificationActivity'));
check('Página emisión: mensaje local/remoto/mixto', page.includes('nota(s) aplicada(s) localmente') && page.includes('destinatario(s) remoto(s)'));
check('Página emisión: emisor/receptor al visor', page.includes('emisorInfo={selectedEmitterInfo}') && page.includes('receptorInfo={selectedReceiverInfo}'));
check('Bandeja: Realtime activo', inbox.includes('subscribeToSacramentalNotificationActivity'));
check('Sidebar: badge sacramental Realtime', sidebar.includes('subscribeToSacramentalNotificationActivity'));

check('Archivo: estados operativos', table.includes('Pendiente de recepción') && table.includes('Recepción parcial') && table.includes('Aplicada localmente'));
check('Archivo: cancelación condicionada', table.includes('row.canCancel'));
check('Filtros: estados operativos', filters.includes('value="partial"') && filters.includes('value="received"') && filters.includes('value="local_processed"'));
check('Confirmación: resume destino local/remoto', confirm.includes('destinatario(s) remoto(s)') && confirm.includes('nota(s) local(es)'));

const authorityFiles = [docModal, printBackup, incomingModal, incomingPrint];
check('Documentos: usan snapshot issuerAuthority', authorityFiles.every((src) => src.includes('issuerAuthority')));
check('Documentos: sin fallback estado=1', authorityFiles.every((src) => !src.includes('estado || p.Estado')));
check('Documento archivo: fuente física/digital visible', docModal.includes('Origen del registro matrimonial'));
check('Impresión archivo: destinatarios múltiples preservados', printBackup.includes('receiverParishNames'));

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\nSACRAMENTUM V16 MATRIMONIAL · FALLÓ · ${failed.length}/${checks.length} controles.`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V16 MATRIMONIAL · OK · ${checks.length}/${checks.length} controles estáticos.`);
