import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canEditChanceryDecreeDocument} from '../src/utils/decreeDocumentEditPolicy.mjs';
const file=path=>fs.readFileSync(path,'utf8');
const sql=file('supabase/deployment/v307_chancery_decree_chat_security.sql');
const page=file('src/pages/chancery/SacramentalDecreeArchivePage.jsx');
const grid=file('src/components/chancery/ChanceryDecreeHierarchy.jsx');
const chat=file('src/pages/CommunicationsPage.jsx');
const chatService=file('src/services/chatService.js');

test('V307 cancillería: solo decreto propio, activo y pendiente de asiento',()=>{
 const row={id:'a',chancery_id:'ch',status:'active',replacement_record_id:null,payload:{
   recordOrigin:'chancery_pending_seat_v280',seatStatus:'awaiting_parish',historical:false
 }};
 assert.equal(canEditChanceryDecreeDocument(row,'ch'),true);
 for(const diff of [
   {chancery_id:'other'}, {status:'reversed'},
   {replacement_record_id:'supletoria'}, {payload:{...row.payload,seatStatus:'completed'}},
   {payload:{...row.payload,historical:true}},
   {payload:{...row.payload,recordOrigin:'historical_archive'}}]){
   assert.equal(canEditChanceryDecreeDocument({...row,...diff},'ch'),false);
 }
 assert.equal(canEditChanceryDecreeDocument(row,''),false);
});

test('V307 base datos: solo texto documental con auditoría; ni libros ni identidad',()=>{
 assert.match(sql,/edit_chancery_decree_document_v307/);
 assert.match(sql,/up\.role='chancery'/);
 assert.match(sql,/up\.diocese_id,up\.chancery_id/);
 assert.match(sql,/diocese_id=di and chancery_id=ch for update/);
 assert.match(sql,/jsonb_object_keys\(patch\)/);
 assert.match(sql,/NOT IN \('reason','evidenceRef'\)/i);
 assert.match(sql,/d\.payload->>'seatStatus'<>'awaiting_parish'/);
 assert.match(sql,/replacement_record_id is not null/);
 assert.match(sql,/INSERT INTO public.registry_audit_log/i);
 assert.match(sql,/before_data,after_data,metadata/);
 assert.match(sql,/revoke all on function public\.edit_chancery_decree_document_v307\(uuid,jsonb,text\) from PUBLIC,anon/i);
 assert.doesNotMatch(sql,/update public\.(baptisms|confirmations|marriages|funerals)\b/i);
});
test('V307 interfaz de Archivo ofrece edición controlada y se refresca tras guardar',()=>{
 assert.match(page,/DecreeDocumentEditModal/);
 assert.match(page,/editChanceryDecreeDocument\(input\)/);
 assert.match(page,/canEditChanceryDecreeDocument\(row,activeChanceryId\)/);
 assert.match(page,/await load\(\)/);
 assert.match(grid,/Editar decreto/);
 assert.match(grid,/canEdit\(row\)/);
 const edit=file('src/components/chancery/DecreeDocumentEditModal.jsx');
 assert.match(edit,/Motivo de la edición/);
 assert.match(edit,/Registrar edición auditada/);
 assert.match(edit,/No cambia la identidad, número, concepto, partida ni el asiento/);
});

test('V307 chat privado o grupo explícito en recepción y envío',()=>{
 assert.match(chat,/room\.kind==='direct'/);
 assert.match(chat,/Privado · solo dos participantes/);
 assert.match(chat,/Grupo compartido/);
 assert.match(chat,/solo tú y el destinatario pueden leer estos mensajes/);
 assert.match(chat,/lo verán los miembros de la jurisdicción diocesana/);
 assert.match(chat,/startDirectChat\(person\.profile_id\)/);
 assert.match(chatService,/rpc\('start_direct_chat'/);
 assert.match(chatService,/rpc\('get_chat_room_messages_v166'/);
});
test('V307 solo el emisor retira su mensaje; contenido reemplazado, sin ventana de 15 minutos',()=>{
 assert.match(chat,/message\.sender_profile_id !== myProfileId/);
 assert.match(chat,/message\.deleted_at/);
 assert.match(chat,/await withdrawChatMessage\(message\.id\)/);
 assert.match(chat,/Eliminar mensaje para todos/);
 assert.match(chat,/institutionalConfirm/);
 assert.match(sql,/sender_profile_id=me and deleted_at is null for update/);
 assert.match(sql,/can_access_chat_room\(room\)/);
 assert.match(sql,/body='Mensaje retirado', metadata='\{\}'::jsonb/);
 assert.doesNotMatch(sql,/15 minutes/);
 assert.match(sql,/grant execute on function public\.withdraw_chat_message\(uuid\) to authenticated/i);
 assert.match(sql,/revoke all on function public\.withdraw_chat_message\(uuid\) from PUBLIC,anon/i);
});
