import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261023142209_chat_message_order_consistency_v165.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-chat-full-lifecycle-v165.sql','utf8');
const catalog=JSON.parse(fs.readFileSync('AUDITORIA_RPC_PRIVILEGIADAS_V164.json','utf8'));
test('V165 SQL migration is correctly versioned and maintains historical rows',()=>{
 assert.match(migration,/ALTER TABLE public\.chat_messages ALTER COLUMN created_at SET DEFAULT clock_timestamp\(\)/);
 assert.doesNotMatch(migration,/^\s*(DELETE|TRUNCATE|DROP|UPDATE public\.chat_messages)\b/im);
});
test('V165 four RPC functions keep SECURITY DEFINER and search_path',()=>{
 for(const name of ['send_chat_message','mark_chat_room_read','get_chat_room_messages','list_my_chat_rooms']){
  assert.match(migration,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\('));
 }
 assert.equal((migration.match(/SECURITY DEFINER/g)||[]).length,4);
 assert.equal((migration.match(/SET search_path TO 'public'/g)||[]).length,4);
});
test('V165 timestamp of each sent message uses wall-clock not fixed transaction time',()=>{
 assert.match(migration,/insert into public\.chat_messages\(room_id,sender_profile_id,body,reply_to_id,created_at\)/);
 assert.match(migration,/values \(p_room_id,v_profile,trim\(p_body\),p_reply_to_id,clock_timestamp\(\)\)/);
});
test('V165 read receipt always uses stable pair time and UUID',()=>{
 assert.match(migration,/where room_id=p_room_id order by created_at desc,id desc limit 1/);
});
test('V165 history newest page and oldest-first list use stable UUID tie-break',()=>{
 assert.match(migration,/order by cm\.created_at desc,cm\.id desc limit v_limit/);
 assert.match(migration,/order by s\.created_at,s\.id/);
});
test('V165 room preview uses stable last message order',()=>{
 assert.match(migration,/from public\.chat_messages cm where cm\.room_id=r\.id order by cm\.created_at desc,cm\.id desc limit 1/);
});
test('V165 migration retains role and membership checks in sender',()=>{
 assert.match(migration,/current_chat_profile_id\(\)/);
 assert.match(migration,/can_access_chat_room\(p_room_id\)/);
 assert.match(migration,/El mensaje supera 4000 caracteres/);
});
test('V165 migration does not broaden privileges',()=>{
 assert.doesNotMatch(migration,/^\s*(GRANT|REVOKE|ALTER FUNCTION|CREATE POLICY)\b/im);
});
test('V165 fixture creates only throwaway rooms and messages',()=>{
 assert.match(qa,/QA-V165-ROOM-MEMBERS/);
 assert.match(qa,/QA-V165-ROOM-EXCLUDED/);
 assert.match(qa,/public\.chat_room_members\(room_id,profile_id,member_role\)/);
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/RESET ROLE;\s*ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
test('V165 three real authenticated role types tested independently',()=>{
 for(const role of ["role='parish'","role='chancery'","role='diocese'"])assert.ok(qa.includes(role),role);
 assert.match(qa,/SET LOCAL ROLE authenticated/);
});
test('V165 positive path exercises write, response, read, withdraw and mask',()=>{
 for(const term of ['QA-V165-PARISH-ORIGINAL','QA-V165-PARISH-REPLY','mark_chat_room_read(r1)',
 'QA-V165-CHANCERY-ANSWER','withdraw_chat_message(m3)','Mensaje retirado'])
 assert.ok(qa.includes(term),term);
});
test('V165 negative path denies nine distinct requests',()=>{
 assert.match(qa,/v_denied<>9 OR v_success<>7/);
 for(const term of ['empty message accepted','oversized message accepted','external quote accepted',
 'chancery withdrew another','duplicate withdrawal succeeded','unauthorized history read allowed',
 'unauthorized message accepted','unauthorized read receipt accepted','unauthorized withdrawal accepted'])
 assert.ok(qa.includes(term),term);
});
test('V165 RLS blocks real authorized profile outside membership',()=>{
 assert.match(qa,/SELECT count\(\*\) INTO v_errors FROM public\.chat_messages WHERE room_id=r1/);
 assert.match(qa,/V165 list_my_chat_rooms disclosed hidden room/);
});
test('V165 legacy timestamp ties receive deterministic receipt and list',()=>{
 assert.match(qa,/created_at='2026-01-01T10:00:00Z'/);
 assert.match(qa,/ORDER BY id DESC LIMIT 1/);
 assert.match(qa,/V165 tied timestamp read position unstable/);
 assert.match(qa,/V165 tied timestamp last message inconsistent/);
 assert.match(qa,/V165 tied timestamp history order inconsistent/);
});
test('V165 prior chat authorization inventory is preserved',()=>{
 const f=catalog.functions.filter(x=>x.schema==='public'&&['mark_chat_room_read','withdraw_chat_message'].includes(x.function_name));
 assert.equal(f.length,2);
 assert.ok(f.every(x=>x.directly_executable_by_authenticated));
});
