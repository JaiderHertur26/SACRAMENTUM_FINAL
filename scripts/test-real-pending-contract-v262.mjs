import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=s=>fs.readFileSync(s,'utf8');
test('V262 new pending bridge reads four real pending tables and server-side attestation',()=>{
 const s=read('scripts/qa-v262-real-pending-adapter.sql');
 for(const t of ['pending_baptisms','pending_confirmations','pending_marriages','pending_funerals'])
  assert.ok(s.includes("'"+t+"'"),'Missing pending table '+t);
 for(const p of [
  'qa_celebration_evidence_v262','verified_at','verified_by','evidence_ref',
  'FOR UPDATE','v_evidence.parish_id<>p_parish_id',
  'v_evidence.sacrament<>p_sacrament','v_evidence.verified_at>clock_timestamp()',
  "v_evidence.origin NOT IN ('new_sacrament','new_decree_supplement')",
  'qa_atomic_seat_v259','qa_pending_v259','qa_seat_calls_v259',
  "status=''seated'',reportado=true"
 ])assert.ok(s.includes(p),'Missing required proof '+p);
 assert.match(s,/SECURITY INVOKER SET search_path=''/);
 assert.match(s,/REVOKE ALL ON FUNCTION sacramentum_ledger.qa_seat_real_pending_v262/);
 assert.doesNotMatch(s,/SECURITY DEFINER|CREATE(?: OR REPLACE)? FUNCTION public\./i);
});
test('V262 never trusts client dates, coordinates or confirmation flags',()=>{
 const s=read('scripts/qa-v262-real-pending-adapter.sql');
 assert.match(s,/SELECT to_jsonb\(p\) FROM public\.%I p/);
 assert.match(s,/raw_data/);
 assert.match(s,/v_raw->>'fechaSacramento'/);
 assert.match(s,/v_json->>'celebration_date'/);
 assert.match(s,/v_json->>'fecha_exequias'/);
 assert.match(s,/v_registration !~ '\^\[0-9\]\{1,30\}\$'/);
 assert.match(s,/v_raw->>'book_number'/);
 assert.match(s,/v_raw->>'Libro'/);
 assert.match(s,/v_evidence.origin/);
 assert.match(s,/v_evidence.decree_effect/);
});
test('V262 tests four pending source shapes and atomic rollback',()=>{
 const s=read('scripts/ci-real-pending-contract-v262.sh');
 for(const v of ['pending_baptisms','pending_confirmations','pending_marriages',
 'pending_funerals','qa_celebration_evidence_v262','historical_import',
 'missing attestation','foreign tenant','future celebration','preassigned coords',
 'physical transaction failure','qa_pending_v259','qa_seat_calls_v259',
 'idempotency'])assert.ok(s.toLowerCase().includes(v.toLowerCase()),'Missing '+v);
 assert.match(s,/PG_CONTAINER:\?/);
 assert.match(s,/db=sacramentum_real_pending_v262/);
});
test('V262 mandatory PostgreSQL CI and local gate',()=>{
 const w=read('.github/workflows/sacramentum-auditoria-v90.yml');
 const g=read('scripts/audit-gate-v90.mjs');
 assert.match(w,/bash scripts\/ci-real-pending-contract-v262\.sh/);
 assert.match(w,/image: postgres:16/);
 assert.match(g,/scripts\/test-real-pending-contract-v262\.mjs/);
});
