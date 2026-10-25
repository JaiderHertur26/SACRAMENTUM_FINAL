import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const actual=JSON.parse(read('AUDITORIA_TIMEOUT_RESULTADOS_V203.json'));
const four=['baptism','confirmation','marriage','funeral'];
const names=['baptisms','confirmations','marriages','funerals'];

test('V203 contains one isolated real PostgreSQL timeout script per sacrament',()=>{
 for(const k of four){
  const s=read(`scripts/qa-rollback-${k}-statement-timeout-v203.sql`);
  assert.match(s,/BEGIN;/);
  assert.match(s,/SET LOCAL statement_timeout='900ms'/);
  assert.match(s,/SET LOCAL ROLE authenticated/);
  assert.match(s,/request\.jwt\.claim\.sub/);
  assert.match(s,/SELECT count\(\*\) INTO ct/);
  assert.match(s,/PERFORM pg_sleep\(2\)/);
  assert.match(s,/SEAT_AND_CONTROL_SLEEP_COMPLETED/);
  assert.match(s,/RESET ROLE/);
  assert.ok(s.trimEnd().endsWith('ROLLBACK;'));
  assert.doesNotMatch(s,/\bCOMMIT\s*;/);
 }
});

test('V203 forces statement timeout only AFTER confirmed actual boleta and partida seat',()=>{
 for(const k of four){
  const s=read(`scripts/qa-rollback-${k}-statement-timeout-v203.sql`);
  const successful=Math.max(s.indexOf('official partida missing before timeout'),s.indexOf('official partida absent before timeout'));
  const boleta=Math.max(s.indexOf('boleta not sealed before timeout'),s.indexOf('pending boleta not closed before timeout'));
  const sleep=s.indexOf('PERFORM pg_sleep(2);');
  assert.ok(successful>0 && boleta>successful && sleep>boleta,k);
  assert.match(s,/status='seated'/);
  assert.match(s,/reportado IS TRUE/);
  assert.match(s,/SET LOCAL statement_timeout='900ms'/);
 }
});

test('V203 records four verified SQLSTATE 57014 failures and four successful post-timeout retries',()=>{
 assert.equal(actual.sacraments.length,4);
 assert.deepEqual(actual.sacraments.map(x=>x.kind),four);
 assert.equal(actual.expected_sqlstate,'57014');
 for(const x of actual.sacraments){
  assert.equal(x.baseline_before,'SEAT_AND_CONTROL_SLEEP_COMPLETED');
  assert.equal(x.timeout_sqlstate,'57014');
  assert.equal(x.timeout_context,'SELECT pg_sleep(2)');
  assert.equal(x.control_after,'SEAT_AND_CONTROL_SLEEP_COMPLETED');
 }
});

test('V203 independently checks all 10 categories of SQL residue after canceled transactions',()=>{
 const s=read('scripts/qa-verify-post-timeout-recovery-v203.sql');
 assert.equal(Object.keys(actual.post_timeout_rows).length,10);
 for(const [k,v] of Object.entries(actual.post_timeout_rows)){
  assert.equal(v,0,k);
  assert.ok(s.includes(`AS ${k}`),k);
 }
 assert.doesNotMatch(s,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
});

test('V203 reports limitations and successful regression of four sacramental seats',()=>{
 assert.equal(actual.four_sacraments_regression.sacramental_lifecycles,4);
 assert.equal(actual.four_sacraments_regression.duplicate_seating_rejected,4);
 assert.ok(actual.limitations.some(x=>x.includes('No two truly overlapping')));
 assert.ok(actual.limitations.some(x=>x.includes('No network disconnect')));
 assert.match(read('AUDITORIA_RECUPERACION_TIMEOUT_V203_2026-10-25.md'),/en el ámbito transaccional PostgreSQL/);
});
