import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const sql=read('scripts/staged-v265-attest-new-celebration.sql');
test('V265 requires V207 immutable creation receipts, never client raw_data flags',()=>{
 assert.match(sql,/public\.pending_creation_requests c/);
 for(const s of ['baptism_pending_id','confirmation_pending_id',"'pending_id'",
   'c.parish_id=p_parish_id','v_receipts<>1','v_pending->>\'status\'',
   "coalesce(v_raw->>'source'",'current_date','verified_by,evidence_ref',
   "origin","'new_sacrament'"])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/SELECT c\.payload_hash INTO v_ref/);
});
test('V265 prevents silent replacement and journals one authorized attestation',()=>{
 assert.match(sql,/up.auth_user_id=v_actor AND up.parish_id=p_parish_id/);
 assert.match(sql,/SELECT \* INTO v_previous/);
 assert.match(sql,/v_previous\.evidence_ref<>v_ref/);
 assert.match(sql,/INSERT INTO public\.registry_audit_log/);
 assert.match(sql,/celebration_attested/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.attest_new_celebration_v265/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265/);
 assert.match(read('scripts/staged-v267-fresh-zero-rpc-cutover.sql'),/GRANT EXECUTE ON FUNCTION public.attest_new_celebration_v265/);
 assert.doesNotMatch(sql,/UPDATE public\.parish_parameters|INSERT INTO public\.baptisms|UPDATE public\.baptisms/);
});
test('V265 provides a manual recorded celebration attestation flow on four shared screens',()=>{
 const panel=read('src/components/LedgerSeatPanelV264.jsx');
 const client=read('src/services/ledgerSeatV264.js');
 assert.match(panel,/Certificar celebración efectuada/);
 assert.match(panel,/onClick=\{\(\)=>verifyCelebration\(row\)\}/);
 assert.match(panel,/attestNewCelebrationV265/);
 assert.match(panel,/await reload\(\)/);
 assert.match(client,/supabase\.rpc\('attest_new_celebration_v265'/);
 assert.match(client,/if \(!ledgerV264Enabled\)/);
 assert.match(panel,/setLocked\(true\)/);
});
test('V265 QA PG16 isolation, negative cases, authorization, replay and forced audit rollback',()=>{
 const ci=read('scripts/ci-celebration-attestation-v265.sh');
 for(const token of [
  'PG_CONTAINER','pending_creation_requests','missing authentication',
  'foreign parish identity','legacy pending rejected','future celebration rejected',
  'wrong sacrament rejected','changed attestation rejected',
  'audit failure rolls back evidence','linked confirmation',
  "SELECT count(*) FROM public.registry_audit_log",'V265 PG16 PASS'
 ]) assert.ok(ci.includes(token),token);
 assert.match(read('.github/workflows/sacramentum-auditoria-v90.yml'),
  /bash scripts\/ci-celebration-attestation-v265\.sh/);
 assert.match(read('scripts/audit-gate-v90.mjs'),/scripts\/test-celebration-attestation-v265\.mjs/);
});

test('V265 atomic cutover requires V260 uniqueness, historical reconciliation and single commit',()=>{
 const sql=read('scripts/staged-v265-atomic-rpc-cutover.sql');
 assert.match(sql,/^BEGIN;/m);
 assert.match(sql,/^COMMIT;/m);
 assert.match(sql,/LOCK TABLE public\.baptisms,public\.confirmations,public\.marriages,public\.funerals/);
 assert.match(sql,/indisunique/);
 assert.match(sql,/indnullsnotdistinct/);
 assert.match(sql,/v_missing<>0/);
 assert.match(sql,/legacy_reconciled=false/);
 assert.equal((sql.match(/REVOKE EXECUTE ON FUNCTION public\.seat_/g)||[]).length,4);
 assert.equal((sql.match(/GRANT EXECUTE ON FUNCTION public\.seat_/g)||[]).length,4);
 for(const s of ['seat_baptism_records','seat_confirmation_records',
  'seat_pending_marriage','seat_funeral_record',
  'seat_baptism_ledger_v263','seat_confirmation_ledger_v263',
  'seat_marriage_ledger_v263','seat_funeral_ledger_v263'])assert.ok(sql.includes(s),s);
 const ci=read('scripts/ci-atomic-rpc-cutover-v265.sh');
 for(const s of ['missing index','historical book without reconciled memory',
   'unreconciled book','PG16 CUTOVER PASS','has_function_privilege',
   'PG_CONTAINER','apply >/dev/null'])
   assert.ok(ci.includes(s),s);
 assert.ok(read('.github/workflows/sacramentum-auditoria-v90.yml').includes('bash scripts/ci-atomic-rpc-cutover-v265.sh'));
});
