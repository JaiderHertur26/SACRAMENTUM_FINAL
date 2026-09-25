import fs from 'node:fs';

const root='C:/SACRAMENTUM/SACRAMENTUM_FINAL/';
const read=(p)=>fs.readFileSync(root+p,'utf8');
const issues=[];
const expect=(ok,msg)=>{ if(!ok) issues.push(msg); };

const sidebar=read('src/components/Sidebar.jsx');
const chanceryIndex=sidebar.indexOf("label: 'Notificaciones Cancillería'");
const sacramentalIndex=sidebar.indexOf("label: 'Notificaciones Sacramentales'");
const baptismIndex=sidebar.indexOf("label: 'Bautismo'");
expect(chanceryIndex>=0,'Sidebar: falta Notificaciones Cancillería');
expect(sacramentalIndex>chanceryIndex,'Sidebar: Notificaciones Sacramentales no está debajo de Cancillería');
expect(sacramentalIndex<baptismIndex,'Sidebar: Notificaciones Sacramentales debe estar antes de Bautismo');
expect(!/Aviso Alerta/.test(sidebar),'Sidebar: aún existe Aviso Alerta dentro de Matrimonio');
expect(/Emitir Notificación/.test(sidebar),'Sidebar: falta emisión matrimonial');
expect(/countSacramentalNotificationAttention/.test(sidebar),'Sidebar: badge sacramental no está conectado');
expect(/sacramentum:notification-badge-refresh/.test(sidebar),'Sidebar: falta refresco vivo de badges');

const app=read('src/App.jsx');
expect(/\/parish\/sacramental-notifications/.test(app),'App: falta ruta Notificaciones Sacramentales');
expect(/\/parish\/decrees\/:decreeId/.test(app),'App: falta ruta directa de decreto');
expect(/parroquia\/matrimonio\/aviso-notificacion"[\s\S]{0,180}Navigate to="\/parish\/sacramental-notifications"/.test(app),
  'App: ruta antigua de Aviso Alerta no redirige a Notificaciones Sacramentales');

const official=read('src/pages/parish/ParishNotificationsPage.jsx');
expect(/new Date\(b\.createdAt\) - new Date\(a\.createdAt\)/.test(official),
  'Cancillería: no ordena estrictamente por fecha descendente');
expect(/\/parish\/decrees\/\$\{notification\.decree_id\}/.test(official),
  'Cancillería: no navega al decreto exacto');
expect(!/archiveOfficialNotification/.test(official),
  'Cancillería: todavía permite archivar/desaparecer notificaciones');
expect(/Leer decreto/.test(official) && /Ver decreto/.test(official),
  'Cancillería: faltan acciones leer/ver decreto');

const decreeDetail=read('src/pages/parish/ParishDecreeDetailPage.jsx');
expect(/\.eq\('parish_id', user\.parishId\)/.test(decreeDetail),
  'Decreto directo: no valida pertenencia a la parroquia');
expect(/Imprimir decreto/.test(decreeDetail),
  'Decreto directo: falta impresión');
expect(/Fundamento \/ Motivo/.test(decreeDetail),
  'Decreto directo: falta fundamento/motivo');
expect(/Nota marginal/.test(decreeDetail),
  'Decreto directo: faltan notas marginales');

const service=read('src/services/matrimonialNotificationsService.js');
for(const fn of [
  'markSacramentalNotificationRead',
  'listSacramentalReceiptInbox',
  'markSacramentalReceiptRead',
  'countSacramentalNotificationAttention'
]){
  expect(service.includes(`function ${fn}`),`Servicio: falta ${fn}`);
}
expect(/sin_leer/.test(service) && /leida/.test(service) && /aceptada/.test(service),
  'Servicio: faltan estados leído/sin leer/aceptada');
expect(/receiptDocumentNumber/.test(service),'Servicio: falta documento de acuse');

const page=read('src/pages/parish/SacramentalNotificationsPage.jsx');
expect(/Recibidas/.test(page),'Bandeja sacramental: falta pestaña Recibidas');
expect(/Confirmaciones de recibido/.test(page),'Bandeja sacramental: falta pestaña Confirmaciones de recibido');
expect(/markSacramentalNotificationRead/.test(page),'Bandeja sacramental: abrir no marca leído');
expect(/processSacramentalRecipient|processMatrimonialRecipient/.test(page),'Bandeja sacramental: aceptar no procesa recepción');
expect(/ModalVerAcuseSacramental/.test(page),'Bandeja sacramental: falta documento de acuse');
expect(!/dismissMatrimonialRecipient/.test(page),'Bandeja sacramental: no debe archivar desde la bandeja principal');

const receipt=read('src/components/ModalVerAcuseSacramental.jsx');
expect(/Constancia de recepción sacramental/.test(receipt),'Acuse: falta título institucional');
expect(/Imprimir acuse/.test(receipt),'Acuse: falta impresión');
expect(/receiptDocumentNumber/.test(receipt),'Acuse: falta número RNS');

const sql=read('supabase/applied-history/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V14.sql');
for(const token of [
  'receipt_document_number',
  'receipt_payload',
  'sender_read_at',
  'mark_sacramental_notification_read',
  'sacramentum_prepare_sacramental_receipt',
  'mark_sacramental_receipt_read',
  'RNS-'
]){
  expect(sql.includes(token),`SQL V14: falta ${token}`);
}

const decreeGuarantee=read('supabase/applied-history/SACRAMENTUM_DECREE_NOTIFICATION_GUARANTEE_V14B.sql');
for(const token of [
  'sacramentum_emit_decree_notification',
  'trg_decree_official_notification_guarantee',
  'deferrable initially deferred',
  'official_notifications',
  'notificationGuaranteed'
]){
  expect(decreeGuarantee.includes(token),`SQL V14B: falta ${token}`);
}
for(const sacrament of ['bautismo','confirmacion','exequias','matrimonio']){
  expect(decreeGuarantee.includes(`when '${sacrament}'`),`SQL V14B: falta etiqueta para ${sacrament}`);
}

if(issues.length){
  console.error('SACRAMENTUM V14 · FALLÓ');
  issues.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
console.log('SACRAMENTUM V14 · OK · Cancillería, bandeja sacramental, lectura, aceptación y acuses verificados.');
