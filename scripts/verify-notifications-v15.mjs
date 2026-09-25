import fs from 'node:fs';

const root='C:/SACRAMENTUM/SACRAMENTUM_FINAL/';
const read=(p)=>fs.readFileSync(root+p,'utf8');
const issues=[];
const expect=(ok,msg)=>{ if(!ok) issues.push(msg); };

const sql=read('supabase/applied-history/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_NULIDAD_V15.sql');

for(const token of [
  'sacramentum_issue_nullity_baptism_notification',
  "'nulidad_matrimonial'",
  "'sacramental_notification'",
  "'NS-NUL-'",
  "'requiresAcceptance',true",
  'v_baptism_parish=v_marriage.parish_id',
  'perform public.sacramentum_issue_nullity_baptism_notification',
  'lastSacramentalNotificationId',
  'lastSacramentalNotificationType',
  "'decreeNumber',v_doc.payload->>'decreeNumber'",
  "'decreeDate',v_doc.payload->>'decreeDate'"
]){
  expect(sql.includes(token),`SQL V15: falta ${token}`);
}

expect(
  /if v_baptism_parish=v_marriage\.parish_id then[\s\S]*?update public\.baptisms[\s\S]*?else[\s\S]*?sacramentum_issue_nullity_baptism_notification/.test(sql),
  'SQL V15: la nulidad no separa Bautismo local de Bautismo remoto'
);

expect(
  /v_notification_type :=[\s\S]*?v_note_type := 'nulidad_matrimonial'[\s\S]*?v_source_type := 'sacramental_notification'/.test(sql),
  'SQL V15: el procesador no distingue trazabilidad de nulidad matrimonial'
);

expect(
  !/insert into public\.official_notifications\([\s\S]{0,1200}Nulidad matrimonial/.test(sql),
  'SQL V15: reintroduce inserción manual de notificación de decreto en vez de V14B'
);
expect(
  /revoke all on function public\.sacramentum_issue_nullity_baptism_notification[\s\S]*?from public, anon, authenticated, service_role/.test(sql),
  'SQL V15: helper interno de nulidad no está cerrado a roles externos'
);
expect(
  /grant execute on function public\.apply_marriage_nullity[\s\S]*?to authenticated, service_role/.test(sql),
  'SQL V15: Cancillería autenticada no tiene EXECUTE sobre nulidad'
);

const service=read('src/services/matrimonialNotificationsService.js');
for(const fn of [
  'listSacramentalInbox',
  'getSacramentalDocument',
  'processSacramentalRecipient'
]){
  expect(service.includes(`function ${fn}`) || service.includes(`const ${fn}`),`Servicio V15: falta ${fn}`);
}
expect(/marriageParish: row\.marriage_parish_id/.test(service),
  'Servicio V15: no mapea parroquia matrimonial');
expect(/notificationType: row\.notification_type/.test(service),
  'Servicio V15: no conserva notification_type');

const inbox=read('src/pages/parish/SacramentalNotificationsPage.jsx');
expect(/listSacramentalInbox/.test(inbox),'Bandeja V15: aún depende del nombre matrimonial para listar');
expect(/getSacramentalDocument/.test(inbox),'Bandeja V15: falta documento sacramental genérico');
expect(/processSacramentalRecipient/.test(inbox),'Bandeja V15: falta aceptación sacramental genérica');

const marriagePage=read('src/pages/parish/NotificacionMatrimonialPage.jsx');
expect(/notificationType[\s\S]{0,120}=== 'matrimonio'/.test(marriagePage),
  'Matrimonio: su archivo específico no filtra documentos de otros tipos');

const table=read('src/components/TablaAvisos.jsx');
expect(/Nulidad matrimonial/.test(table),'Tabla V15: falta etiqueta humana de nulidad matrimonial');
expect(/Decreto\/Sentencia/.test(table),'Tabla V15: falta referencia del decreto de nulidad');

const modal=read('src/components/ModalVerAviso.jsx');
expect(/isNullity/.test(modal),'Modal V15: no detecta nulidad');
expect(/Sentencia \/ Decreto de Nulidad Matrimonial/.test(modal),
  'Modal V15: falta bloque de sentencia/decreto');
expect(/Cancillería \/ Tribunal Eclesiástico/.test(modal),
  'Modal V15: falta autoridad emisora de nulidad');

const printable=read('src/components/VistaImprimibleDocumento.jsx');
expect(/NOTIFICACIÓN SACRAMENTAL · NULIDAD MATRIMONIAL/.test(printable),
  'Impresión V15: falta título de nulidad');
expect(/III\. Nota Marginal a Asentar/.test(printable),
  'Impresión V15: falta nota marginal a asentar');
expect(/CANCILLERÍA DIOCESANA \/ TRIBUNAL ECLESIÁSTICO/.test(printable),
  'Impresión V15: nulidad no identifica autoridad emisora');
expect(/isNullity \? 'Autoridad emisora' : 'Párroco \/ Encargado'/.test(printable),
  'Impresión V15: puede atribuir falsamente firma parroquial a la nulidad');

const receipt=read('src/components/ModalVerAcuseSacramental.jsx');
expect(/Decreto \/ Sentencia/.test(receipt),'Acuse V15: falta número de sentencia/decreto');
expect(/Fecha del Decreto/.test(receipt),'Acuse V15: falta fecha del decreto');
expect(/nulidad_matrimonial/.test(receipt),'Acuse V15: no detecta tipo nulidad');

const smoke=read('supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_NULIDAD_V15_SMOKE.sql');
for(const token of [
  'remote_baptism_untouched_before_accept',
  'nullity_notification_created',
  'nullity_note_after_accept',
  'receipt_created_and_read',
  "v_receipt_payload->>'decreeNumber'"
]){
  expect(smoke.includes(token),`Smoke V15: falta ${token}`);
}
expect(/rollback;/i.test(smoke),'Smoke V15: debe terminar en ROLLBACK');

if(issues.length){
  console.error('SACRAMENTUM V15 · FALLÓ');
  issues.forEach((x)=>console.error(' - '+x));
  process.exit(1);
}

console.log('SACRAMENTUM V15 · OK · nulidad interparroquial, aceptación, nota marginal, documento y acuse verificados.');
