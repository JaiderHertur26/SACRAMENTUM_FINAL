import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
test('V275 real Funeral seat maps both baptism references into typed baptism_id',()=>{
 const s=read('scripts/staged-v263-four-real-seat-rpcs.sql');
 for(const t of [
  'V275: Exequias tiene referencias bautismales contradictorias',
  'V275: referencia bautismal de Exequias inválida',
  "v_raw->>'baptism_record_id'",
  "v_raw->>'baptismRecordId'",
  'baptism_id,nombres,apellidos',
  "m.book_type,'seated',v_baptism,v_raw->>'nombres'",
  "'baptism_record_id',v_baptism"
 ])assert.ok(s.includes(t),t);
 assert.doesNotMatch(s,/UPDATE public\.baptisms SET is_deceased=true/);
});
test('V275 disposable PostgreSQL16 checks SAME transaction, parish, identity and dates and notes',()=>{
 const fixture=read('scripts/qa-v275-funeral-baptism-triggers.sql');
 for(const t of [
  'trg_validate_funeral_baptism','trg_sync_baptism_death_from_funeral',
  'v_b.parish_id','v_b.linked_funeral_id',
  'is_deceased=true','linked_funeral_id=new.id',
  'marginal_notes','mark_deceased_from_funeral'
 ]) {
  if(t==='v_b.parish_id')assert.match(fixture,/parish_id=new\.parish_id/);
  else assert.ok(fixture.includes(t),t);
 }
 const ci=read('scripts/ci-four-real-seat-rpcs-v263.sh');
 for(const t of [
  'qa-v275-funeral-baptism-triggers.sql',
  'funeral/baptism identity mismatch denied',
  'cross-parish Baptism cannot be marked deceased',
  'death before Baptism denied',
  'ambiguous baptism reference denied',
  'V275 PG16 PASS',
  'SELECT death_date',
  "note_type='defuncion'",
  'where id='
 ])assert.ok(ci.toLowerCase().includes(t.toLowerCase()),t);
});
test('V275 must keep the original live triggers, not redefine them on Supabase',()=>{
 const s=read('scripts/staged-v263-four-real-seat-rpcs.sql');
 assert.doesNotMatch(s,/CREATE TRIGGER trg_validate_funeral_baptism/);
 assert.doesNotMatch(s,/CREATE TRIGGER trg_sync_baptism_death_from_funeral/);
 assert.match(read('.github/workflows/sacramentum-auditoria-v90.yml'),/test-funeral-baptism-link-v275.mjs/);
});
