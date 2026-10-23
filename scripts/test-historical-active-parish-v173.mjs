// V173: all privileged historical books must share one fail-closed parish authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023192627_guard_historical_baptism_active_parish_v173.sql','utf8');
const pre=fs.readFileSync('scripts/qa-rollback-historical-baptism-suspended-repro-v173.sql','utf8');
const baptism=fs.readFileSync('scripts/qa-rollback-historical-baptism-active-parish-v173.sql','utf8');
const others=fs.readFileSync('scripts/qa-rollback-historical-four-workflows-v173.sql','utf8');
for(const fn of [
 'register_historical_baptism_internal(uuid,jsonb)',
 'register_historical_confirmation_internal(uuid,jsonb,uuid,text)',
 'register_historical_marriage(uuid,jsonb)',
 'register_historical_funeral(uuid,jsonb)',
 'register_historical_narrative(uuid,text,jsonb)',
 'register_historical_confirmation(uuid,jsonb,uuid,text)']){
 test('V173 guards SQL function '+fn,()=>assert.ok(migration.includes(fn),fn));
}
test('V173 strict status, is_active and territorial concordance for all internals',()=>{
 assert.match(migration,/is_active IS TRUE/);
 assert.match(migration,/upper\(coalesce\(status,'SUSPENDED'\)\)='ACTIVE'/);
 assert.match(migration,/v173_parish\.diocese_id=public\.user_profiles\.diocese_id/);
 assert.match(migration,/v173_parish\.id=p_parish_id/);
 assert.match(migration,/diocese_id IS NOT NULL/);
});
test('V173 checks status and scope also at Confirmation wrapper entry',()=>{
 assert.match(migration,/up\.is_active IS TRUE/);
 assert.match(migration,/upper\(coalesce\(up\.status,'SUSPENDED'\)\)='ACTIVE'/);
 assert.match(migration,/v173_parish\.diocese_id=up\.diocese_id/);
});
test('V173 fails closed if a SQL authorization anchor changed or duplicated',()=>{
 assert.match(migration,/regexp_count\(v_original,v_pattern,1,'i'\)<>1/);
 assert.match(migration,/expected confirmation wrapper authorization anchor missing/);
 assert.match(migration,/v_changed<>6/);
});
test('V173 changes only existing function bodies without touching records or privileges',()=>{
 assert.doesNotMatch(migration,/\bDROP FUNCTION\b|\bALTER TABLE\b|\bTRUNCATE\b|\bGRANT\b|\bREVOKE\b|\bINSERT INTO\b|\bDELETE FROM\b/i);
 assert.match(migration,/pg_get_functiondef\(v_oid\)/);
 assert.match(migration,/EXECUTE regexp_replace\(v_original,v_pattern,v_guard,'i'\)/);
});
test('V173 archived book coordinates and body remain unchanged',()=>{
 assert.ok(!migration.includes('SET book_number'));
 assert.ok(!migration.includes('SET folio'));
 assert.ok(!migration.includes('SET number'));
});
test('V173 repro genuinely called public historical Baptism with suspended actor',()=>{
 assert.match(pre,/status='SUSPENDED'/);
 assert.match(pre,/register_historical_baptism\(v_parish,v_document\)/);
 assert.match(pre,/V173_PREPATCH_CONFIRMED/);
});
test('V173 Baptism real DB QA tests suspended and wrong-diocese rejection then owner success',()=>{
 for(const s of ['suspended parish registered historical Baptism','foreign diocese profile registered Baptism','active owning parish cannot register Baptism','expected exactly one historical audit event']){
  assert.ok(baptism.includes(s),s);
 }
});
test('V173 four other RPCs reject both suspended and foreign-scoped actor',()=>{
 for(const name of ['register_historical_confirmation','register_historical_marriage','register_historical_funeral','register_historical_narrative']) assert.ok(others.includes(name),name);
 assert.match(others,/blocked<>4/g);
 assert.equal((others.match(/blocked<>4/g)||[]).length,2);
});
test('V173 no persistence in any SQL experiment',()=>{
 for(const sql of [pre,baptism,others]){
  assert.match(sql,/^BEGIN;$/m);
  assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\s*;/mi);
  assert.match(sql,/@example\.invalid/);
 }
});
