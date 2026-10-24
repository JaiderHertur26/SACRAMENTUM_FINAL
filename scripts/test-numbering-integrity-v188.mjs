import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=(p)=>fs.readFileSync(p,'utf8');
const migration=sql('supabase/migrations/20261024183828_registry_normalized_uniqueness_v188.sql');
const readOnly=sql('scripts/qa-readonly-numbering-v187.sql');
const collision=sql('scripts/qa-rollback-registry-uniqueness-v187.sql');
const normalized=sql('scripts/qa-rollback-registry-normalized-v188.sql');
const decree=sql('scripts/qa-rollback-decree-number-v187.sql');

test('V188 migration is additive four precise normalized unique indexes',()=>{
 assert.equal((migration.match(/CREATE UNIQUE INDEX IF NOT EXISTS/gi)||[]).length,4);
 for (const name of ['baptisms','confirmations','marriages','funerals']) {
  assert.match(migration,new RegExp('ON public\\.'+name+'\\b'));
  assert.match(migration,new RegExp('uq_'+name+'_registry_normalized_v188'));
 }
 assert.equal((migration.match(/lower\(btrim\((?:book_number|folio|number)\)\)/gi)||[]).length,12);
 assert.equal((migration.match(/WHERE parish_id IS NOT NULL/gi)||[]).length,4);
 assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i);
});
test('V188 separate book types only for marriage and exequias',()=>{
 for(const s of migration.split('CREATE UNIQUE INDEX').slice(1)){
  const table=s.match(/ON public\.(\w+)/)[1];
  assert.equal(s.includes('(parish_id, book_type,'),['marriages','funerals'].includes(table));
 }
});
test('V188 normalized duplicate test uses subtransactions and full rollback',()=>{
 assert.match(normalized,/\bBEGIN;/);
 assert.match(normalized,/\bROLLBACK;\s*$/);
 assert.match(normalized,/WHEN unique_violation/);
 assert.match(normalized,/lower\(book\)/);
 for (const s of ['baptisms','confirmations','marriages','funerals'])assert.ok(normalized.includes(s));
});
test('V187 exact duplicate and court decree number test remain reversible',()=>{
 for(const q of [collision,decree]){
  assert.match(q,/\bBEGIN;/);assert.match(q,/\bROLLBACK;\s*$/);
 }
 assert.match(decree,/El número ya corresponde a otro decreto de esta diócesis/);
 assert.match(decree,/lower\(number_one\)/);
});
test('V187 live catalog test requires all four indexes and complete references',()=>{
 assert.match(readOnly,/BEGIN READ ONLY;/i);
 assert.match(readOnly,/ROLLBACK;\s*$/);
 assert.match(readOnly,/v_incomplete<>0 OR v_dup<>0/);
 assert.match(readOnly,/uq_decretos_diocese_number/);
});
