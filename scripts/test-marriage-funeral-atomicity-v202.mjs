import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const atomic=read('scripts/qa-rollback-marriage-funeral-atomicity-v202.sql');
const sequence=read('scripts/qa-rollback-marriage-funeral-sequential-v202.sql');
const v201=read('scripts/qa-rollback-batch-atomicity-v201.sql');

test('V202 fault after official marriage and funeral seat rolls back full SQL subtransaction',()=>{
 for(const rpc of ['create_pending_marriage','create_pending_funeral','seat_pending_marriage','seat_funeral_record'])
  assert.ok(atomic.includes(rpc),rpc);
 assert.match(atomic,/QA202_FORCED_FAILURE_AFTER_SUCCESS/);
 assert.match(atomic,/EXCEPTION WHEN OTHERS/);
 assert.match(atomic,/success_inside<>2 OR rolled_back<>2/);
 assert.match(atomic,/partial official record survived forced rollback/);
 assert.match(atomic,/counter changed despite forced rollback/);
 assert.match(atomic,/pending record lost after forced rollback/);
 assert.ok(atomic.trimEnd().endsWith('ROLLBACK;'));
});
test('V202 checks no phantom juridical audit logs before retries and exact audit logs after',()=>{
 assert.match(atomic,/SELECT count\(\*\) INTO ct FROM public\.registry_audit_log/);
 assert.match(atomic,/IF ct<>0 THEN RAISE EXCEPTION 'QA202 audit record survived forced rollback/);
 assert.match(atomic,/IF ct<>2 THEN RAISE EXCEPTION 'QA202 exactly two legal audits expected/);
 assert.match(atomic,/RESET ROLE;\nDO \$audit_clean\$/);
 assert.match(atomic,/RESET ROLE;\nDO \$audit_final\$/);
});
test('V202 retries restore the official sacramental seat without unauthorized duplicate',()=>{
 assert.match(atomic,/legitimate_retry_seatings/);
 assert.match(atomic,/duplicate_retries_rejected/);
 assert.match(atomic,/completed<>2 OR duplicate_denied<>2/);
 assert.match(atomic,/result\.next_number<>2/);
});
test('V202 two sequential boletas per sacrament preserve their unique numbers and folio changes',()=>{
 assert.match(sequence,/FOR i IN 1\.\.2 LOOP/);
 assert.match(sequence,/outcome\.number<>lpad\(i::text,4,'0'\)/);
 assert.match(sequence,/outcome\.next_number<>3 OR outcome\.next_folio<>2/);
 assert.match(sequence,/seated<>4 OR duplicates<>4/);
 assert.match(sequence,/status=''seated'' AND reportado IS TRUE/);
 assert.ok(sequence.trimEnd().endsWith('ROLLBACK;'));
});
test('V202 combines independent V201 batch failure coverage across all four sacraments',()=>{
 assert.match(v201,/blocked<>2 OR recovered<>2 OR valid_pending<>4/);
 for(const f of [atomic,sequence,v201]){
  assert.match(f,/SET LOCAL ROLE authenticated/);
  assert.match(f,/request\.jwt\.claim\.sub/);
  assert.doesNotMatch(f,/\bCOMMIT\s*;/i);
 }
 assert.match(sequence,/two distinct pending records/);
});
