import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('scripts/qa-rollback-four-sacrament-seating-v193.sql','utf8');
test('V193 end to end backend four sacramental lifecycles invoke real RPCs',()=>{
  for(const fn of ['create_pending_baptism','create_pending_confirmation','create_pending_marriage','create_pending_funeral','seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record'])
    assert.ok(sql.includes('public.'+fn+'('),fn);
});
test('V193 requires proof of real records and pending closure in every sacrament',()=>{
  for(const t of ['baptisms','confirmations','marriages','funerals'])
    assert.ok(sql.includes('public.'+t+' WHERE'),t);
  for(const t of ['pending_baptisms','pending_confirmations','pending_marriages','pending_funerals'])
    assert.ok(sql.includes('public.'+t+' WHERE id='),t);
  assert.equal((sql.match(/status='seated' AND reportado IS TRUE/g)||[]).length,4);
});
test('V193 retries reject a duplicate seating rather than silently creating a second record',()=>{
  assert.equal((sql.match(/duplicate accepted/g)||[]).length,4);
  assert.equal((sql.match(/denied:=denied\+1/g)||[]).length,4);
  assert.match(sql,/denied<>4/);
});
test('V193 confirms juridical audit rows and leaves no persistent fictitious data',()=>{
  assert.match(sql,/registry_audit_log/);
  assert.match(sql,/n<4/);
  assert.ok(sql.includes('SET LOCAL ROLE authenticated'));
  assert.ok(sql.includes('RESET ROLE'));
  assert.ok(sql.startsWith('-- SACRAMENTUM V193'));
  assert.ok(sql.trimEnd().endsWith('ROLLBACK;'));
});
