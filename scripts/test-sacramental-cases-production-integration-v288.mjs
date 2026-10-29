import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const app=read('src/App.jsx');
const wiz=read('src/pages/parish/SacramentalCaseWizardV277.jsx');
const inbox=read('src/pages/parish/SacramentalNotificationsPage.jsx');
const srv=read('src/services/sacramentalCasesV277.js');
const receipt=read('src/components/SacramentalCaseDocumentV277.jsx');
const modal=read('src/components/ModalVerAviso.jsx');
const sql=read('scripts/v288-notification-close-and-private-evidence.sql');
const sql289=read('scripts/v289-view-complete-case-both-parishes.sql');

test('V288 nuevo circuito reutiliza la ruta parroquial protegida y no modifica App.jsx',()=>{
 assert.match(app,/path="\/parroquia\/matrimonio\/notificacion" element={<ProtectedRoute requiredRole={ROLE_TYPES\.PARISH}><NotificacionMatrimonialPage/);
 assert.doesNotMatch(app,/path="\/parish\/sacramental-cases"/);
 assert.match(app,/path="\/parroquia\/matrimonio\/notificacion"/);
 assert.match(app,/path="\/parroquia\/confirmacion\/notificacion"/);
});
test('V288 Matrimonio y Confirmación anteriores conservan sus formularios y enlace integral',()=>{
 const m=read('src/pages/parish/NotificacionMatrimonialPage.jsx');
 const c=read('src/pages/parish/ConfirmationNotificationPage.jsx');
 assert.match(m,/FormularioNotificacionMatrimonial/);
 assert.match(m,/FormularioNotificacionManual/);
 assert.match(m,/to="\/parroquia\/matrimonio\/notificacion\?v277=1"/);
 assert.match(m,/MatrimonialCorrespondenceRoute/);
 assert.match(c,/issueConfirmationNotification/);
 assert.match(c,/sacrament=confirmacion/);
});
test('V288 cada contrayente tiene parroquia distinta, local, del sistema o externa',()=>{
 assert.match(wiz,/const setMode=\(mode\)=>edit/);
 assert.match(wiz,/Otra parroquia del sistema/);
 assert.match(wiz,/Fuera de SACRAMENTUM/);
 assert.match(wiz,/Dos personas|dos personas|2 contrayentes/);
});
test('V288 permite completar localización de Bautismo físico en el destinatario',()=>{
 assert.match(inbox,/updatePhysicalLocatorV277/);
 assert.match(inbox,/onUpdateLocator={requestPhysicalLocator}/);
 assert.match(inbox,/Localizar Bautismo en libro físico/);
 assert.match(modal,/onUpdateLocator/);
});
test('V288 el emisor no declara ejecutada una devolución sin PDF o imagen',()=>{
 assert.match(wiz,/type="file" accept="\.pdf,\.png,\.jpg,\.jpeg/);
 assert.match(wiz,/certified/);
 assert.match(srv,/sacramental-return-evidence/);
 assert.match(srv,/file\.size>10485760/);
 assert.match(srv,/record_external_sacramental_return_v288/);
});
test('V288 el bucket privado está protegido por parroquia emisora',()=>{
 assert.match(sql,/sacramental-return-evidence','sacramental-return-evidence',false/);
 assert.match(sql,/sacramental_evidence_sender_insert_v288/);
 assert.match(sql,/up\.auth_user_id=auth\.uid\(\)/);
 assert.match(sql,/n\.sender_parish_id/);
 assert.match(sql,/storage\.objects/);
});
test('V288 no admite cerrar expediente por cancelación',()=>{
 assert.match(sql,/NEW\.status<>'processed'/);
 assert.match(sql,/r\.status='cancelled'/);
 assert.match(sql,/done_count<>expected_count/);
 assert.match(sql,/NEW\.status:='sent'/);
});
test('V289 documento consolidado accesible a emisor y destinatario autorizado',()=>{
 assert.match(sql289,/public\.can_read_matrimonial_notification/);
 assert.match(sql289,/recipientTracking/);
 assert.match(sql289,/sourceParties/);
 assert.match(inbox,/getSacramentalCaseDocumentV289/);
 assert.match(inbox,/onViewCaseDocument={openCompleteCase}/);
});
test('V288 documento final no es imprimible hasta cierre del expediente',()=>{
 assert.match(srv,/summary\.readyToPrint && document\.status==='processed'/);
 assert.match(wiz,/preview\.documentReady\?"Imprimir expediente completo"/);
 assert.match(receipt,/Copia para remisión y seguimiento/);
 assert.match(inbox,/completeCase\.documentReady && <Button onClick={printCompleteCase}/);
 assert.match(receipt,/Seguimiento pendiente/);
});
test('V288 archivo matrimonial antiguo no imprime versión V277 como final',()=>{
 const m=read('src/pages/parish/NotificacionMatrimonialPage.jsx');
 assert.match(m,/doc\.caseVersion !== 'V277'/);
});
