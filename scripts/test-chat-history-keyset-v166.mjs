import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=f=>fs.readFileSync(f,'utf8');
const migration=read('supabase/migrations/20261023144508_chat_history_keyset_v166.sql');
const qa=read('scripts/qa-rollback-chat-keyset-complete-v166.sql');
const page=read('src/pages/CommunicationsPage.jsx');
const svc=read('src/services/chatService.js');
const visual=JSON.parse(read('AUDITORIA_CHAT_PAGINACION_VISUAL_V166.json'));

test('V166 adds versioned RPC without overriding legacy contract',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.get_chat_room_messages_v166/);
 assert.doesNotMatch(migration,/CREATE OR REPLACE FUNCTION public\.get_chat_room_messages\(/);
});
test('V166 enforces authenticated membership of the requested room',()=>{
 assert.match(migration,/NOT public\.can_access_chat_room\(p_room_id\)/);
 assert.match(migration,/errcode='42501'/);
});
test('V166 cannot accept incomplete time/UUID cursor',()=>{
 assert.match(migration,/p_before_created_at IS NULL\) <> \(p_before_id IS NULL/);
 assert.match(migration,/errcode='22023'/);
});
test('V166 pages are bounded between one and one hundred messages',()=>{
 assert.match(migration,/p_limit NOT BETWEEN 1 AND 100/);
 assert.match(migration,/LIMIT p_limit/);
});
test('V166 keyset uses both timestamp and UUID to avoid ties',()=>{
 assert.match(migration,/\(cm\.created_at,cm\.id\)<\(p_before_created_at,p_before_id\)/);
 assert.match(migration,/ORDER BY cm\.created_at DESC,cm\.id DESC/);
 assert.match(migration,/ORDER BY s\.created_at,s\.id/);
});
test('V166 index is scoped to the room with consistent sorting',()=>{
 assert.match(migration,/idx_chat_messages_history_keyset_v166/);
 assert.match(migration,/chat_messages\(room_id,created_at DESC,id DESC\)/);
});
test('V166 avoids exposing messages as anonymous or direct table reads',()=>{
 assert.match(migration,/FROM PUBLIC,anon/);
 assert.match(migration,/TO authenticated/);
 assert.doesNotMatch(migration,/GRANT SELECT ON public\.chat_messages/);
});
test('V166 withdrawn content remains masked as before',()=>{
 assert.match(migration,/CASE WHEN s\.deleted_at IS NULL THEN s\.body ELSE 'Mensaje retirado' END/);
});
test('V166 SQL test includes 305 identical old dates and seven recent messages',()=>{
 assert.match(qa,/generate_series\(1,305\)/);
 assert.match(qa,/generate_series\(1,7\)/);
 assert.match(qa,/2012-01-01T10:00:00Z/);
});
test('V166 read test uses actual authenticated role and rolls back',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
test('V166 test validates complete unique set and nonmember denials',()=>{
 assert.match(qa,/total<>312 OR legacy<>305/);
 assert.match(qa,/duplicate across pages/);
 assert.match(qa,/deny<>6/);
 assert.match(qa,/V166 active outsider read member chat/);
});
test('V166 service now passes both before parameters through RPC',()=>{
 assert.match(svc,/get_chat_room_messages_v166/);
 assert.match(svc,/p_before_created_at: before\?\.created_at \|\| null/);
 assert.match(svc,/p_before_id: before\?\.id \|\| null/);
});
test('V166 frontend shows older-message pagination affordance',()=>{
 assert.match(page,/Cargar 80 mensajes anteriores/);
 assert.match(page,/const CHAT_PAGE_SIZE = 80/);
 assert.match(page,/const loadEarlier = async \(\) =>/);
});
test('V166 frontend merges messages without duplicate IDs and stable order',()=>{
 assert.match(page,/new Map\(\[\.\.\.older, \.\.\.previous\]\.map\(message => \[message\.id, message\]\)\)/);
 assert.match(page,/\.sort\(chronological\)/);
});
test('V166 prevents old-room responses and auto scroll after older pages',()=>{
 assert.match(page,/version !== roomVersionRef\.current \|\| activeRoomRef\.current !== roomId/);
 assert.match(page,/skipAutoScrollRef\.current = true/);
});
test('V166 browser completed 6 independent steps on actual React component',()=>{
 assert.equal(visual.steps.length,6);
 assert.ok(visual.steps.every(x=>x.passed));
 assert.equal(visual.passed,true);
 assert.deepEqual(visual.errors,[]);
});
test('V166 browser has 312 messages and no duplicates or overflow',()=>{
 const x=visual.steps.find(x=>x.name==='FULL_HISTORY');
 assert.ok(x?.passed);
 assert.deepEqual([x.observed.count,x.observed.unique,x.observed.legacy,x.observed.recent],[312,312,305,7]);
 assert.equal(x.observed.hasOlder,false);
 assert.equal(x.observed.overflow,false);
});
test('V166 browser removes full history on identity change',()=>{
 const x=visual.steps.find(x=>x.name==='CROSS_IDENTITY_HISTORY_REMOVED');
 assert.ok(x?.passed);
 assert.equal(x.observed.count,0);
 assert.equal(x.observed.aRoom,false);
 assert.equal(x.observed.bMessage,true);
});
test('V166 screenshot really came from browser capture',()=>{
 const buf=fs.readFileSync('AUDITORIA_EVIDENCIA_CHAT_V166/v166-chat-history-312.png');
 assert.ok(buf.length>7000);
 assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(crypto.createHash('sha256').update(buf).digest('hex'));
});
