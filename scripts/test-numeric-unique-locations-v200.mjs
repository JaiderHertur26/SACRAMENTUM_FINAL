import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const mig=read('supabase/migrations/20261025012000_registry_numeric_location_unique_v200.sql');
const qa=read('scripts/qa-rollback-numeric-unique-four-sacraments-v200.sql');
const verify=read('scripts/qa-verify-numeric-registry-integrity-v200.sql');
test('V200 requires four unique indexes on normalized numeric coordinates',()=>{
 for(const kind of ['baptisms','confirmations','marriages','funerals']){
  assert.match(mig,new RegExp('CREATE UNIQUE INDEX IF NOT EXISTS uq_'+kind+'_numeric_location_v200'));
  assert.match(mig,new RegExp('ON public\\.'+kind));
 }
 assert.equal((mig.match(/CREATE UNIQUE INDEX/g)||[]).length,4);
 assert.equal((mig.match(/ltrim\(btrim\(book_number\), '0'\)/g)||[]).length,4);
 assert.equal((mig.match(/ltrim\(btrim\(folio\), '0'\)/g)||[]).length,4);
 assert.equal((mig.match(/ltrim\(btrim\(number\), '0'\)/g)||[]).length,4);
});
test('V200 marriage and funeral preserve independent ordinary and supplementary books',()=>{
 for(const t of ['marriages','funerals']){
  assert.match(mig,new RegExp('uq_'+t+'_numeric_location_v200[\\s\\S]+?lower\\(btrim\\(book_type\\)\\)'));
 }
 assert.match(qa,/suplementario/);
 assert.match(qa,/allowed_other_booktype<>2/);
});
test('V200 indexes only numeric coordinates and do not modify old records',()=>{
 assert.equal((mig.match(/btrim\(book_number\) ~ '\^\[0-9\]\+\$'/g)||[]).length,4);
 assert.match(mig,/WHERE parish_id IS NOT NULL/);
 assert.doesNotMatch(mig,/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bDROP TABLE\b/);
});
test('V200 real SQL test detects four equivalent-format duplicates and preserves parish separation',()=>{
 for(const kind of ['baptisms','confirmations','marriages','funerals'])assert.ok(qa.includes("'"+kind+"'"));
 assert.match(qa,/unique_violation/);
 assert.match(qa,/blocked<>4 OR allowed_other_parish<>4 OR allowed_other_booktype<>2/);
 assert.match(qa,/009877/);
 assert.match(qa,/9877/);
 assert.ok(qa.trimEnd().endsWith('ROLLBACK;'));
});
test('V200 live-state report verifies no canonical numeric duplicates and four valid indexes',()=>{
 assert.match(verify,/numeric_equivalent_duplicate_locations/);
 assert.match(verify,/enforced_valid_unique_indexes/);
 assert.match(verify,/pi\.indisunique IS TRUE AND pi\.indisvalid IS TRUE/);
 assert.match(verify,/GROUP BY kind,parish_id,class,book,page,entry HAVING count\(\*\)>1/);
});
