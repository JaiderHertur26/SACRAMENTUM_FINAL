import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const sql=read('scripts/staged-v263-four-real-seat-rpcs.sql');
test('V263 creates real writers for four sacraments with one locked private ledger',()=>{
 for(const name of [
  'seat_baptism_ledger_v263','seat_confirmation_ledger_v263',
  'seat_marriage_ledger_v263','seat_funeral_ledger_v263'])
  assert.ok(sql.includes('FUNCTION public.'+name),'Missing '+name);
 for(const table of ['baptisms','confirmations','marriages','funerals']){
  assert.ok(sql.includes('INSERT INTO public.'+table),'Missing record materialization '+table);
 }
 assert.match(sql,/FROM sacramentum_ledger.book_memories\s+WHERE id=p_book_id FOR UPDATE/);
 assert.match(sql,/qa_append_batch_v253/);
 assert.match(sql,/FROM public\.user_profiles up/);
 assert.match(sql,/upper\(coalesce\(up\.status,''\)\)='ACTIVE'/);
 assert.match(sql,/v_registry_table:=CASE p_sacrament/);
 assert.match(sql,/verified_by IS NULL/);
 assert.match(sql,/evidence\.origin='new_decree_supplement'/);
});
test('V263 forbids legacy numeric coordinates and guarantees all-or-nothing record effects',()=>{
 for(const token of ['v_raw->>k','v_registration !~','v_date>current_date',
  "status=''seated'', reportado=true","status=''pending''",
  'INSERT INTO public.registry_audit_log',
  'INSERT INTO public.marginal_notes',
  'UPDATE public.baptisms SET',
  'v_baptism_existing','v_record:=gen_random_uuid()',
  'GET DIAGNOSTICS v_count=ROW_COUNT'])assert.ok(sql.includes(token),'Missing '+token);
 assert.doesNotMatch(sql,/UPDATE public\.parish_parameters/);
 assert.doesNotMatch(sql,/TRUNCATE|DROP TABLE|DELETE FROM public\.(?:baptisms|confirmations|marriages|funerals)/i);
});
test('V263 staged surface is denied from public and anonymous roles',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON sacramentum_ledger.celebration_attestations_v263 FROM PUBLIC,anon,authenticated/);
 assert.equal((sql.match(/REVOKE ALL ON FUNCTION public\.seat_\w+_ledger_v263/g)||[]).length,4);
 assert.match(sql,/REVOKE ALL ON FUNCTION sacramentum_ledger.real_seat_v263/);
 assert.doesNotMatch(sql,/GRANT EXECUTE/);
});
test('V263 real PG fixture checks cross-note, records, audit, history and rollback',()=>{
 const ci=read('scripts/ci-four-real-seat-rpcs-v263.sh');
 for(const s of ['ci-four-real-seat-rpcs-v263.sh'.replace('ci-four-real-seat-rpcs-v263.sh','sacramentum_four_real_rpcs_v263'),
   'qa-v252-ledger-memory-schema.sql','qa-v253-ledger-transactions.sql',
   'staged-v263-four-real-seat-rpcs.sql','pending_baptisms','pending_confirmations',
   'pending_marriages','pending_funerals','marginal_notes','registry_audit_log',
   'cross parish denied','wrong active role owner','qa_fail_audit_v263',
   'audit failure rolls everything back','has_function_privilege'])
    assert.ok(ci.includes(s),'Missing fixture: '+s);
 const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
 const gate=read('scripts/audit-gate-v90.mjs');
 assert.match(workflow,/bash scripts\/ci-four-real-seat-rpcs-v263\.sh/);
 assert.match(gate,/scripts\/test-four-real-seat-rpcs-v263\.mjs/);
});
