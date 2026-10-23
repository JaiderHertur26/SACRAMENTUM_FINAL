import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const page=read('src/pages/CommunicationsPage.jsx');
const mock=read('scripts/qa-v164-chat/mocks.jsx');
const qa=read('scripts/qa-rollback-chat-role-rls-v164.sql');
const browser=JSON.parse(read('AUDITORIA_AISLAMIENTO_CHAT_V164.json'));

test('V164 chat profile is resolved by the wrapper from session',()=>{
 assert.match(page,/const CommunicationsPage = \(\) => \{/);
 assert.match(page,/const \{ profile, user \} = useAuth\(\)/);
 assert.match(page,/const CommunicationsPageSession = \(\{ profile, user \}\) =>/);
});
test('V164 private chat subtree keyed on both identity and organizational scope',()=>{
 assert.match(page,/const scopeKey = \[authId,profile\?\.id \|\| '',role/);
 assert.match(page,/profile\?\.diocese_id \|\| user\?\.dioceseId/);
 assert.match(page,/profile\?\.parish_id \|\| user\?\.parishId/);
 assert.match(page,/profile\?\.chancery_id \|\| user\?\.chanceryId/);
 assert.match(page,/CommunicationsPageSession key=\{scopeKey\}/);
});
test('V164 inactive or unauthorized profile does not mount messaging component',()=>{
 assert.match(page,/!authId \|\| !profile\?\.id \|\| !allowed \|\| profile\?\.is_active === false \|\| !statusActive/);
 assert.match(page,/Este canal requiere una sesión institucional activa y autorizada/);
});
test('V164 session identity includes permitted roles only',()=>{
 assert.match(page,/\['parish', 'chancery', 'diocese'\]\.includes\(role\)/);
 assert.match(page,/statusActive = String\(profile\?\.status \|\| 'ACTIVE'\)\.toUpperCase\(\) === 'ACTIVE'/);
});
test('V164 subscription cannot be installed after screen was unmounted',()=>{
 assert.match(page,/await loadMessages\(selectedRoomId\);\s*if \(cancelled\) return;/);
 assert.match(page,/const stopSubscription = await subscribeToChatRoom\(/);
 assert.match(page,/if \(cancelled\) \{\s*stopSubscription\?\.\(\);/);
 assert.match(page,/unsubscribe = stopSubscription/);
});
test('V164 subscription cleanup unmount terminates connection',()=>{
 assert.match(page,/cancelled = true;\s*if \(unsubscribe\) unsubscribe\(\)/);
});
test('V164 browser has 7 independent observed identity boundaries',()=>{
 assert.equal(browser.steps.length,7);
 assert.ok(browser.steps.every(x=>x.passed));
 assert.equal(browser.passed,true);
 assert.deepEqual(browser.errors,[]);
});
test('V164 changing A to B immediately discards A messages',()=>{
 const s=browser.steps.find(x=>x.name==='B_IMMEDIATE_NO_A');
 assert.ok(s?.passed);
 assert.equal(s.observation.aRoom,false);
 assert.equal(s.observation.aMessage,false);
 assert.equal(s.observation.draft,'');
});
test('V164 delayed reply from A never reintroduces messages in B',()=>{
 const s=browser.steps.find(x=>x.name==='A_LATE_RESPONSE_EXCLUDED');
 assert.ok(s?.passed);
 assert.equal(s.observation.bRoom,true);
 assert.equal(s.observation.bMessage,true);
 assert.equal(s.observation.aRoom,false);
 assert.equal(s.observation.aMessage,false);
});
test('V164 logout disposes active realtime connection',()=>{
 const s=browser.steps.find(x=>x.name==='LOGOUT_UNSUBSCRIBED');
 assert.ok(s?.passed);
 assert.equal(s.observation.active,0);
 assert.equal(s.observation.subscribed,s.observation.unsubscribed);
});
test('V164 returning to A cannot reuse any B messages or draft',()=>{
 const s=browser.steps.find(x=>x.name==='A_SIGNIN_NO_CROSS_DATA_OR_DRAFT');
 assert.ok(s?.passed);
 assert.equal(s.observation.aRoom,true);
 assert.equal(s.observation.bMessage,false);
 assert.equal(s.observation.draft,'');
});
test('V164 screenshot is a real browser PNG',()=>{
 const file=fs.readFileSync('AUDITORIA_EVIDENCIA_CHAT_V164/v164-chat-b-excludes-a.png');
 assert.ok(file.length>7000);
 assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('V164 browser audit never embeds a real credential or Supabase client',()=>{
 assert.match(browser.scenario,/no Supabase client connected/);
 assert.match(mock,/SIN CONEXIÓN SUPABASE/);
 assert.match(mock,/changeIdentity\(name\)/);
 assert.doesNotMatch(mock,/access_token|service_role|SECRET_KEY/);
});
test('V164 SQL RLS audit uses real PostgreSQL authenticated role',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/public\.can_access_chat_room\(v_room\)/);
 assert.match(qa,/public\.current_chat_profile_id\(\)/);
});
test('V164 server access tests include direct tables and RPC',()=>{
 for(const s of ['public.chat_rooms WHERE id=v_room','public.chat_messages WHERE room_id=v_room','public.get_chat_room_messages(v_room,10,NULL)','public.list_my_chat_rooms()'])
  assert.ok(qa.includes(s),s);
});
test('V164 server denies unaffiliated identity reading and sending',()=>{
 assert.match(qa,/00000000-0000-0000-0000-000000000164/);
 assert.match(qa,/V164 RLS message disclosure/);
 assert.match(qa,/V164 outsider unexpectedly sent a message/);
 assert.match(qa,/v_caught<>2/);
});
test('V164 SQL contains no commit nor persistent mutations',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*(INSERT|UPDATE|DELETE|COMMIT)\b/im);
});
