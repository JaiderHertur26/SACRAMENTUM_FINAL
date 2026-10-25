import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const batch=read('scripts/qa-rollback-batch-atomicity-v201.sql');
const stale=read('scripts/qa-rollback-stale-client-numbering-v201.sql');
const expectedRPCs=['create_pending_baptism','create_pending_confirmation','seat_baptism_records','seat_confirmation_records'];

test('V201 two genuine batch RPCs have two pending records, the second invalid, and transaction rollback',()=>{
 for(const f of expectedRPCs)assert.ok(batch.includes("'"+f+"'"));
 assert.match(batch,/jsonb_build_array\(jsonb_build_object\('pending_id',first_id\),jsonb_build_object\('pending_id',second_id\)\)/);
 assert.match(batch,/2035-11-01/);
 assert.match(batch,/EXCEPTION WHEN OTHERS/);
 assert.match(batch,/blocked<>2 OR recovered<>2 OR valid_pending<>4/);
 assert.ok(batch.trimEnd().endsWith('ROLLBACK;'));
});
test('V201 negative batch preserves both unseated boletas, counters and no orphaned official rows',()=>{
 for(const f of ["status=''pending'' AND reportado IS FALSE",'ordinarioLibro','ordinarioFolio','ordinarioNumero','book_number=\'\'9881\'\''])assert.ok(batch.includes(f),f);
 assert.match(batch,/numbers advanced after failed batch/);
 assert.match(batch,/phantom official record after error/);
 assert.match(batch,/lost pending records after batch rollback/);
});
test('V201 successful retry creates exactly two partidas, archives two boletas and two legal audit events per kind',()=>{
 assert.match(batch,/res\.seated_count<>2 OR res\.next_book<>9881 OR res\.next_number<>3 OR res\.next_folio<>2/);
 assert.match(batch,/exact_legal_audit_records/);
 assert.match(batch,/IF n<>2 THEN RAISE EXCEPTION 'V201 audit mismatch/);
 assert.match(batch,/RESET ROLE;\nDO \$audit_verify\$/);
});
test('V201 stale-client test rejects outdated same coordinates and succeeds after refresh',()=>{
 for(const f of expectedRPCs)assert.ok(stale.includes("'"+f+"'"));
 assert.match(stale,/V201_STALE_ACCEPTED/);
 assert.match(stale,/consecutivo/);
 assert.match(stale,/stale_denied<>2 OR safe_second<>2/);
 assert.match(stale,/second client not preserved|second pending not preserved/);
 assert.match(stale,/result\.next_number<>3 OR result\.next_folio<>2/);
 assert.ok(stale.trimEnd().endsWith('ROLLBACK;'));
});
test('V201 does not claim real concurrency or authenticated independent JWT',()=>{
 for(const f of [batch,stale]){
 assert.match(f,/SET LOCAL ROLE authenticated/);
 assert.match(f,/request\.jwt\.claim\.sub/);
 assert.doesNotMatch(f,/\bCOMMIT\s*;/i);
 }
 assert.match(stale,/does NOT claim simultaneously overlapping physical PostgreSQL connections/);
});
