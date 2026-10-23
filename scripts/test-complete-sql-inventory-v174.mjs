import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const inventory=JSON.parse(fs.readFileSync('AUDITORIA_INVENTARIO_SQL_V174.json','utf8'));
const ledger=JSON.parse(fs.readFileSync('AUDITORIA_RESULTADOS_SQL_V174.json','utf8'));
// Frozen V174 receipt: later version fixtures are tested by their own protocol.
const original=fs.readdirSync('scripts').filter(f=>/^qa-rollback-.*\.sql$/.test(f)).filter(f=>{const v=f.match(/-v(\d+)\.sql$/);return !v||Number(v[1])<=174;}).sort();
test('V174 inventory includes every and only actual SQL QA file',()=>{
 assert.deepEqual(inventory.inventory.map(x=>x.file),original);
 assert.equal(original.length,97);
});
test('V174 current scripts have 1 BEGIN and 1 ROLLBACK, never COMMIT or external operation',()=>{
 assert.equal(inventory.unqualified.length,0);
 for(const item of inventory.inventory){
  assert.equal(item.transactions.begins,1,item.file);
  assert.equal(item.transactions.rollbacks,1,item.file);
  assert.equal(item.transactions.commits,0,item.file);
  assert.equal(item.externalOperations,false,item.file);
 }
});
test('V174 historical repro scripts excluded, current regression count 75',()=>{
 assert.equal(inventory.baseline,22);
 assert.equal(inventory.inventory.filter(x=>!x.historicBaseline).length,75);
 assert.equal(ledger.currentRegressionCount,75);
 assert.equal(ledger.historicalReproductionArchiveCount,22);
});
test('V174 every active regression has named prior or current SQL pass proof',()=>{
 const active=new Set(inventory.inventory.filter(x=>!x.historicBaseline).map(x=>x.file));
 const evidence=[
  ...ledger.previouslyVerified,
  ...ledger.verifiedNowExisting,
  ...ledger.verifiedNowNew
 ];
 assert.equal(evidence.length,75);
 assert.equal(new Set(evidence).size,75);
 assert.deepEqual(new Set(evidence),active);
});
test('V174 distinguish 30 historical verified from 45 current verified',()=>{
 assert.equal(ledger.priorVerifiedCount,30);
 assert.equal(ledger.verifiedNowCount,45);
 assert.equal(ledger.verifiedNowExisting.length,43);
 assert.equal(ledger.verifiedNowNew.length,2);
});
test('V174 historical unauthorized notification test is superseded by denial regression',()=>{
 assert.ok(inventory.inventory.find(x=>x.file==='qa-rollback-notification-read-spoof-v133.sql')?.historicBaseline);
 const qa=fs.readFileSync('scripts/qa-rollback-notification-read-spoof-rejected-v174.sql','utf8');
 assert.match(qa,/No autorizado para esta notificación/);
 assert.match(qa,/v_status IS DISTINCT FROM 'pending'/);
 assert.match(qa,/ROLLBACK;\s*$/);
});
test('V174 historical unauthorized nullity test is superseded by denial regression',()=>{
 assert.ok(inventory.inventory.find(x=>x.file==='qa-rollback-nullity-without-preauthorization-v128.sql')?.historicBaseline);
 const qa=fs.readFileSync('scripts/qa-rollback-nullity-without-preauthorization-rejected-v174.sql','utf8');
 assert.match(qa,/La nulidad exige autorización documental previa/);
 assert.match(qa,/v_status IS DISTINCT FROM 'seated'/);
 assert.match(qa,/v_decree IS NOT NULL/);
 assert.match(qa,/ROLLBACK;\s*$/);
});
test('V174 no claims of full E2E, simultaneous SQL transactions or stress certification',()=>{
 assert.ok(ledger.unresolved.some(x=>/two/i.test(x)&&/PostgreSQL/i.test(x)));
 assert.ok(ledger.unresolved.some(x=>/browser/i.test(x)));
 assert.ok(ledger.unresolved.some(x=>/performance|High-load/i.test(x)));
});
