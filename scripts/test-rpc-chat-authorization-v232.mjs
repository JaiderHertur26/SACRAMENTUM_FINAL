import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {report as migrationInventory} from './audit-production-migration-safety-v231.mjs';

const before=JSON.parse(fs.readFileSync('AUDITORIA_RPC_152_FUENTE_LIVE_V232.json','utf8'));
const after=JSON.parse(fs.readFileSync('AUDITORIA_RPC_152_POST_LIVE_V232.json','utf8'));
const live=JSON.parse(fs.readFileSync('AUDITORIA_CHAT_ACTOR_QA_REAL_V232.json','utf8'));
const historical=JSON.parse(fs.readFileSync('AUDITORIA_MIGRACIONES_DATOS_V232.json','utf8'));
const migration='supabase/migrations/20261027125848_harden_chat_actor_guard_v232.sql';
const names=['mark_chat_room_read','send_chat_message','withdraw_chat_message'];
const getKey=r=>r.name+'('+r.args+')';
const tablePre=new Map(before.entries.map(x=>[getKey(x),x]));
const tablePost=new Map(after.entries.map(x=>[getKey(x),x]));
const hash=s=>createHash('sha256').update(s).digest('hex');

test('V232 QA privileged routine inventory is an authentic SELECT-only source, not a certification',()=>{
 assert.equal(before.protocol,'V232');
 assert.equal(after.protocol,'V232_POST');
 assert.equal(before.projectRef,'foczofcmwampjvlfbsqn');
 assert.equal(after.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(before.officialApproval,false);
 assert.equal(after.officialApproved,false);
 assert.equal(before.summary.semanticallyApproved,0);
 assert.equal(after.semanticallyReviewed,0);
 assert.equal(before.entries.length,152);
 assert.equal(after.entries.length,152);
});
test('V232 all exposed functions are individually fingerprinted with stable identity signatures',()=>{
 assert.equal(tablePre.size,152);
 assert.equal(tablePost.size,152);
 assert.deepEqual([...tablePre.keys()].sort(),[...tablePost.keys()].sort());
 for(const entry of after.entries){
  assert.match(entry.source_md5,/^[a-f0-9]{32}$/);
  assert.equal(entry.manualReviewComplete,false);
  assert.equal(entry.owner,'postgres');
 }
});
test('V232 before hardening, exactly 134 functions directly referenced auth.uid',()=>{
 assert.equal(before.summary.withDirectUid,134);
 assert.equal(before.summary.noDirectUid,18);
 assert.equal(before.summary.withoutDirectUidOrCommonGuard,14);
 assert.equal(before.summary.dmlTextCandidates,101);
});
test('V232 after hardening, 137 functions explicitly check auth.uid and only fifteen delegate or omit it',()=>{
 assert.equal(after.counts.total,152);
 assert.equal(after.counts.direct_uid,137);
 assert.equal(after.counts.delegated_or_indirect,15);
 assert.equal(after.counts.without_common_guard_reference,11);
 assert.equal(after.counts.dml_candidates,101);
});
test('V232 no writable _internal privileged routine is directly exposed to authenticated',()=>{
 assert.equal(after.counts.internal_named_exposed,0);
 assert.equal(before.summary.exposedInternalNamed,0);
});
test('V232 source does not show editable user metadata authorization or dynamic EXECUTE risk',()=>{
 assert.equal(after.counts.user_metadata_mentions,0);
 assert.equal(after.counts.dynamic_execution_candidates,0);
 assert.equal(before.summary.editableMetadataCandidates,0);
 assert.equal(before.summary.dynamicExecuteCandidates,0);
});
test('V232 exactly three PostgreSQL function source hashes changed in the live QA database',()=>{
 const changed=[];
 for(const [key,current] of tablePost){
  const previous=tablePre.get(key);
  assert.ok(previous);
  if(previous.source_md5!==current.source_md5)changed.push(current.name);
 }
 assert.deepEqual(changed.sort(),names.slice().sort());
 assert.deepEqual(after.sourceDifferences.slice().sort(),names.slice().sort());
});
test('V232 only three mutating chat functions now have explicit identity checks',()=>{
 for(const name of names){
  const a=before.entries.find(x=>x.name===name);
  const b=after.entries.find(x=>x.name===name);
  assert.ok(a&&!a.references_auth_uid);
  assert.ok(b&&b.references_auth_uid);
  assert.equal(b.body_contains_dml,true);
 }
});
test('V232 real migration was applied at exact remote Supabase version',()=>{
 assert.equal(live.remoteMigration.version,'20261027125848');
 assert.equal(live.remoteMigration.name,'harden_chat_actor_guard_v232');
 assert.equal(live.remoteMigration.file,migration);
 assert.equal(live.remoteMigration.applied,true);
 const sql=fs.readFileSync(migration,'utf8');
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length,3);
 assert.equal((sql.match(/IF auth\.uid\(\) IS NULL THEN/g)||[]).length,3);
 assert.equal((sql.match(/ERRCODE='42501'/g)||[]).length,3);
 assert.equal((sql.match(/SECURITY DEFINER/g)||[]).length,3);
 assert.doesNotMatch(sql,/^\s*(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|GRANT\s+ALL|REVOKE\s+ALL)/gim);
});
test('V232 session checks preserve membership, role and message ownership guards',()=>{
 const sql=fs.readFileSync(migration,'utf8');
 for(const ref of ['public.current_chat_profile_id()','public.can_access_chat_room(',
  'sender_profile_id=v_profile','public.chat_room_members','public.chat_messages'])
  assert.ok(sql.includes(ref),ref);
});
test('V232 real authenticated PostgreSQL actor was denied sending to a different diocese room',()=>{
 assert.equal(live.accessTests.crossDioceseForeignRoomCandidates,12);
 assert.equal(live.accessTests.foreignRoomSendRejected,true);
});
test('V232 real authenticated PostgreSQL actor was denied marking foreign room as read',()=>{
 assert.equal(live.accessTests.foreignRoomReadMarkerRejected,true);
});
test('V232 real authenticated PostgreSQL actor was denied withdrawing a message not owned',()=>{
 assert.equal(live.accessTests.foreignMessageWithdrawalRejected,true);
});
test('V232 chat QA tests use BEGIN and ROLLBACK without persisting foreign records',()=>{
 assert.equal(live.accessTests.operationsWithinTransaction,true);
 assert.equal(live.accessTests.transactionRolledBack,true);
 assert.equal(live.accessTests.noMessageRowsAdded,true);
 assert.equal(live.accessTests.noReadMarkersChanged,true);
 assert.equal(live.accessTests.noForeignWithdrawalsCommitted,true);
 assert.equal(live.accessTests.explicitMissingSessionSqlstate,'42501');
});
test('V232 all sacramental totals and fictitious auth users remain unchanged',()=>{
 assert.deepEqual(live.qaBeforeAfter,{
  baptisms:5040,confirmations:2091,marriages:1261,funerals:1,
  chat_messages:1,chat_rooms:4,chat_room_members:16,auth_users:12});
});
test('V232 187 migrations are now versioned without reauthorizing old QA DML',()=>{
 assert.equal(historical.protocol,'V232');
 assert.equal(historical.migrationCount,187);
 assert.equal(historical.directWriteMigrationCount,14);
 assert.equal(historical.directWriteStatementCount,45);
 const current=migrationInventory();
 assert.deepEqual(historical.checks,current.checks);
 assert.deepEqual(historical.findings,current.findings);
 const clean=JSON.parse(fs.readFileSync('AUDITORIA_MIGRACIONES_LANZAMIENTO_LIMPIO_V232.json','utf8'));
 assert.equal(clean.summary.blockedDataStatements,39);
 assert.equal(clean.summary.referenceTemplateCandidates,6);
});
test('V232 hardening did not waive formal authorization review for any of 152 functions',()=>{
 assert.equal(before.summary.reviewStatusesPending,152);
 assert.ok(before.entries.every(x=>x.semanticAuthorizationReviewed===false));
 assert.ok(after.entries.every(x=>x.manualReviewComplete===false));
 assert.ok(live.mustNotClaim.some(s=>s.includes('152')));
});
test('V232 no private email, JWT or user UUID in actual QA evidence',()=>{
 const raw=JSON.stringify(live)+JSON.stringify(after)+JSON.stringify(before);
 assert.doesNotMatch(raw,/"(?:password|access_token|refresh_token|email|service_role_key|apiKey)"\s*:/i);
 assert.doesNotMatch(raw,/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i);
});
test('V232 regression matrix is wired to gate and GitHub without credential access',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(f,'utf8'),/scripts\/test-rpc-chat-authorization-v232\.mjs/);
 const ci=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 assert.doesNotMatch(ci,/run:.*audit-live-auth-v208|run:.*apply_migration/);
});
