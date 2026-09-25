import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
const check=(name,ok)=>{
  const pass=Boolean(ok);
  checks.push({name,pass});
  console.log(pass?'✓':'✗',name);
};

const auditSql=read('supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_AUDITORIA_V16B.sql');
const manualSql=read('supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_MANUAL_V16C.sql');
const smoke=read('supabase/postflight/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_V16C_SMOKE.sql');
const service=read('src/services/matrimonialNotificationsService.js');
const search=read('src/components/BusquedaPartidaBautismo.jsx');
const resolveModal=read('src/components/ModalVincularPartidaNotificacion.jsx');
const noticeModal=read('src/components/ModalVerAviso.jsx');
const page=read('src/pages/parish/SacramentalNotificationsPage.jsx');
const table=read('src/components/TablaAvisos.jsx');
const receipt=read('src/components/ModalVerAcuseSacramental.jsx');
const archiveModal=read('src/components/ModalVerDocumento.jsx');check('V16B audita primera lectura receptora',
  auditSql.includes("'read_sacramental_notification'") && auditSql.includes('v_first_read'));
check('V16B audita primera lectura RNS',
  auditSql.includes("'read_sacramental_receipt'") && auditSql.includes('sender_read_at'));

check('V16C guardia manual activa',
  manualSql.includes('sacramentum_guard_manual_recipient_processing')
  && manualSql.includes('debe vincular una partida digital o certificar el asiento físico'));
check('V16C RPC vinculación digital',
  manualSql.includes('resolve_manual_matrimonial_notification_recipient'));
check('V16C verifica misma parroquia',
  manualSql.includes('b.parish_id=v_parish'));
check('V16C verifica Libro/Folio/Número exactos',
  manualSql.includes('b.book_number') && manualSql.includes('b.folio') && manualSql.includes('b.number'));
check('V16C congela snapshot tras resolución',
  manualSql.includes("'baptismSnapshot',v_snapshot") && manualSql.includes("'acceptanceMode','digital_link'"));
check('V16C certificación física',
  manualSql.includes('process_manual_matrimonial_notification_physical')
  && manualSql.includes("'physicalNoteCertified',true")
  && manualSql.includes("'acceptanceMode','physical_book'"));
check('V16C auditoría resolución y físico',
  manualSql.includes("'resolve_manual_baptism'") && manualSql.includes("'process_physical_book'"));
check('V16C permisos RPC',
  manualSql.includes('grant execute on function public.resolve_manual_matrimonial_notification_recipient')
  && manualSql.includes('grant execute on function public.process_manual_matrimonial_notification_physical'));check('Servicio expone resolución manual',
  service.includes('resolveManualMatrimonialRecipient'));
check('Servicio expone aceptación física',
  service.includes('processManualMatrimonialPhysical'));
check('Servicio bloquea aceptación manual ambigua',
  service.includes('Antes de aceptar debe vincular la partida digital o certificar el asiento'));
check('Servicio conserva acceptanceMode en RNS',
  service.includes('acceptanceMode:'));

check('Buscador restringe por parroquia',
  search.includes('restrictParishId') && search.includes('String(row.parish_id) === String(restrictParishId)'));
check('Buscador bloquea localizador',
  search.includes('lockLocator') && search.includes('disabled={lockLocator}'));
check('Modal de vinculación usa referencia exacta',
  resolveModal.includes('initialLocator={locator}') && resolveModal.includes('restrictParishId={parishId}'));

check('Documento recibido detecta manual no resuelta',
  noticeModal.includes('isManualUnlinked'));
check('Documento recibido ofrece vincular digital',
  noticeModal.includes('Vincular partida digital'));
check('Documento recibido ofrece certificar físico',
  noticeModal.includes('Certificar asiento físico'));check('Bandeja conecta RPC de resolución',
  page.includes('resolveManualMatrimonialRecipient'));
check('Bandeja conecta certificación física',
  page.includes('processManualMatrimonialPhysical'));
check('Bandeja exige confirmación explícita física',
  page.includes('la nota ya fue asentada físicamente'));
check('Bandeja usa modal de vinculación',
  page.includes('ModalVincularPartidaNotificacion'));

check('Tabla cambia Aceptar por Resolver',
  table.includes('Resolver partida física antes de aceptar') && table.includes('> Resolver<'));
check('Tabla muestra referencia física',
  table.includes('Partida física L.'));

check('RNS muestra modo de recepción',
  receipt.includes('Modo de recepción') && receipt.includes('physical_book') && receipt.includes('digital_link'));
check('Archivo muestra seguimiento por parroquia',
  archiveModal.includes('Seguimiento de recepción por parroquia')
  && archiveModal.includes('Acuse leído por emisor'));

check('Smoke V16C prueba ambos caminos',
  smoke.includes('digital_manual_resolved')
  && smoke.includes('physical_certified')
  && smoke.includes('physical_standard_blocked')
  && smoke.includes('resolution_audited'));

const failed=checks.filter(c=>!c.pass);
if(failed.length){
  console.error(`\nSACRAMENTUM V16C · FALLÓ · ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nSACRAMENTUM V16C · OK · ${checks.length}/${checks.length} controles.`);
