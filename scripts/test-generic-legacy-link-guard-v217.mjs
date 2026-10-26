import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migrationPath='supabase/migrations/20261026131258_guard_generic_legacy_registral_links_v217.sql';
const migration=fs.readFileSync(migrationPath,'utf8');
const repro=fs.readFileSync('scripts/qa-rollback-generic-link-cross-parish-repro-v217.sql','utf8');
const guard=fs.readFileSync('scripts/qa-rollback-generic-link-protection-v217.sql','utf8');
const inventory=fs.readFileSync('scripts/qa-readonly-legacy-link-inventory-v217.sql','utf8');
for(const [label,part] of [
 ['common trigger is reused','sacramentum_guard_legacy_record_link_identity'],
 ['preserves existing name/date checks','execute replace(v_ddl,v_old,v_new)'],
 ['fail-closed for unrecognized source code','position(v_old in v_ddl)=0'],
 ['serializes historical key writes','pg_advisory_xact_lock'],
 ['requires original batch','new.batch_id'],
 ['requires original staging row','new.row_id'],
 ['requires same source system','b.source_system=new.source_system'],
 ['requires same profile','b.profile_key=new.profile_key'],
 ['requires exact source key','coalesce(r.source_key,r.row_number::text)=new.source_key'],
 ['requires parish exists','public.parishes p'],
 ['disallows original target mutation','old.target_id is distinct from new.target_id'],
 ['disallows historical key change','old.source_key is distinct from new.source_key'],
 ['disallows historical profile change','old.profile_key is distinct from new.profile_key'],
 ['disallows source system change','old.source_system is distinct from new.source_system'],
 ['disallows escaping the guard by changing target to a catalog',"old.target_table in ("],
 ['disallows original target-table mutation','old.target_table is distinct from new.target_table'],
 ['disallows provenance batch switch across parishes','prior.parish_id=current_batch.parish_id'],
 ['rejects unowned records','V217 el expediente registral destino no existe en la parroquia de procedencia'],
 ['baptism owned record','from public.baptisms t'],
 ['confirmation owned record','from public.confirmations t'],
 ['marriage owned record','from public.marriages t'],
 ['funeral owned record','from public.funerals t'],
 ['baptism pending physical ownership','from public.pending_baptisms t'],
 ['confirmation pending physical ownership','from public.pending_confirmations t'],
 ['marriage pending physical ownership','from public.pending_marriages t'],
 ['funeral pending physical ownership','from public.pending_funerals t'],
 ['historical notes physical ownership','from public.marginal_notes t'],
 ['historical note queues physical ownership','from public.legacy_marginal_note_queue t']
])test('V217 central registral guard: '+label,()=>{
 assert.ok(migration.includes(part),label);
});
test('V217 cannot delete, truncate or rewrite sacramental history',()=>{
 assert.doesNotMatch(migration,/\bTRUNCATE\b|\bDROP\s+(?:TABLE|FUNCTION)\b|DELETE FROM public\.(?:baptisms|confirmations|marriages|funerals|legacy_record_links)/i);
});
for(const [profile,table] of [['BAUTIZOS','baptism'],['CONFIRMA','confirmation'],['MATRIMON','marriage'],['DIFUNTOS','funeral']]){
 const p=profile==='BAUTIZOS'?'scripts/qa-rollback-generic-link-protection-v217.sql':'scripts/qa-rollback-generic-link-'+profile.toLowerCase()+'-v217.sql';
 test('V217 integration QA includes '+profile+' and '+table,()=>{
  const s=fs.readFileSync(p,'utf8');
  assert.ok(s.includes("'"+profile+"'"));
  assert.ok(s.includes("'"+table+"'"));
  assert.match(s,/cross_parish_source_overwrite_denied/);
  assert.match(s,/foreign_target_denied/);
  assert.match(s,/same_target_replay_safe/);
 });
}
for(const p of [
 'scripts/qa-rollback-generic-link-cross-parish-repro-v217.sql',
 'scripts/qa-rollback-generic-link-protection-v217.sql',
 'scripts/qa-rollback-generic-link-confirma-v217.sql',
 'scripts/qa-rollback-generic-link-matrimon-v217.sql',
 'scripts/qa-rollback-generic-link-difuntos-v217.sql'
])test('V217 QA cannot persist any fictitious data: '+p,()=>{
 const s=fs.readFileSync(p,'utf8');
 assert.match(s,/^BEGIN;$/m);
 assert.match(s,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(s,/\bCOMMIT\s*;/i);
});
test('V217 current historical anomaly query is strictly read-only',()=>{
 assert.match(inventory,/owner_verified/);
 assert.match(inventory,/target_not_found/);
 assert.match(inventory,/actual_cross_parish/);
 assert.doesNotMatch(inventory,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\s+(?:INTO|FROM|TABLE|FUNCTION|public)/i);
});
test('V217 migration keeps the original completed V216 note guard',()=>{
 const v216=fs.readFileSync('supabase/migrations/20261026124426_guard_marginal_note_historical_parish_v216.sql','utf8');
 assert.match(v216,/pg_advisory_xact_lock/);
 assert.match(v216,/Nota marginal histórica vinculada a otra parroquia/);
});
