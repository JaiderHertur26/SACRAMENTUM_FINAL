import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');

test('V259 atomic wrapper reads authoritative pending records and blocks historical paths',()=>{
  const sql=read('scripts/qa-v259-atomic-physical-seat.sql');
  for(const required of [
    'qa_pending_v259','qa_seat_calls_v259','qa_atomic_seat_v259',
    'qa_append_batch_v253','FOR UPDATE','source.has_physical_coordinates IS TRUE',
    "source.flow='new_decree_supplement'","source.flow<>'new_sacrament'",
    "m.book_type<>'suplementario'","m.book_type<>'ordinario'",
    'source.registration_number','source.celebration_date','source.verified',
    'source.parish_id<>p_parish_id','source.sacrament<>p_sacrament',
    'v_fingerprint','previous.fingerprint','RETURN previous.response',
    'INSERT INTO sacramentum_ledger.qa_seat_calls_v259'
  ]) assert.ok(sql.includes(required),'Missing V259 atomic guarantee: '+required);
  assert.match(sql,/REVOKE ALL ON FUNCTION sacramentum_ledger.qa_atomic_seat_v259/);
  assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.|SECURITY DEFINER/i);
});
test('V259 creates one source-linked physical record in each of the four sacraments',()=>{
  const sql=read('scripts/qa-v259-atomic-physical-seat.sql');
  for(const table of ['baptisms','confirmations','marriages','funerals'])
    assert.ok(sql.includes("'"+table+"'"),'Missing physical target '+table);
  assert.match(sql,/INSERT INTO public\.%I\(id,parish_id,book_number,folio,number,book_type,pending_id\)/);
  assert.match(sql,/UPDATE sacramentum_ledger.qa_pending_v259 SET status='seated'/);
  assert.match(sql,/r\.folio::numeric=\$3 AND r\.number::numeric=\$4/);
  assert.match(sql,/upper\(r\.book_number\)/);
  assert.match(sql,/m\.canonical_code/);
});
test('V259 blocks historical occupied slots and reverses entire operation on registry insertion failure',()=>{
  const sh=read('scripts/ci-physical-seat-binding-v259.sh');
  for(const s of ['qa-v252-ledger-memory-schema.sql','qa-v253-ledger-transactions.sql',
    'qa-v259-atomic-physical-seat.sql','for table in baptisms confirmations marriages funerals',
    'historical_import','physical coordinate already occupied','active_count',
    'seat_events','QA physical insert failure','status FROM sacramentum_ledger.qa_pending_v259',
    'registry_audit_log'.replace('registry_audit_log','qa_seat_calls_v259'),
    'new_decree_supplement','suplementario','idempotency fingerprint mismatch',
    'two extra scopes'.replace('two extra scopes','another parish')]){
    assert.ok(sh.includes(s),'Missing isolated test '+s);
  }
  assert.match(sh,/db=sacramentum_four_physical_seats_v259/);
  assert.match(sh,/PG_CONTAINER:\?/);
});
test('V259 CI runs exclusively on disposable PostgreSQL service',()=>{
  const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
  assert.match(workflow,/image: postgres:16/);
  assert.match(workflow,/bash scripts\/ci-physical-seat-binding-v259\.sh/);
  assert.match(workflow,/PG_CONTAINER: \$\{\{ job\.services\.postgres\.id \}\}/);
});
