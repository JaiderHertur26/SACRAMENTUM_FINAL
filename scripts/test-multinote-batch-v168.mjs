import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261023180000_batch_later_note_reconciliation_v168.sql');
const one=read('scripts/qa-rollback-multinote-batch-v168.sql');
const four=read('scripts/qa-rollback-multinote-four-sacraments-v168.sql');
const service=read('src/services/laterNoteReconciliationService.js');
const page=read('src/pages/chancery/LaterNoteReconciliationPage.jsx');

test('V168 introduces an explicit versioned batch RPC, leaving legacy RPCs untouched',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.execute_later_note_reconciliation_batch_v168/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.execute_later_note_reconciliation_v156/);
});
test('V168 batch is SECURITY DEFINER with fixed schema path',()=>{
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path TO 'public'/);
});
test('V168 browser cannot authorize or execute bypassing chancery role',()=>{
 assert.match(sql,/public\.current_app_role\(\) IS DISTINCT FROM 'chancery'/);
 assert.match(sql,/sacramentum_assert_chancery_for_parish/);
 assert.match(sql,/public\.current_app_diocese_id\(\) IS DISTINCT FROM v_diocese_id/);
});
test('V168 input requires 2 to 30 unique cases, no nulls',()=>{
 assert.match(sql,/cardinality\(p_case_ids\) NOT BETWEEN 2 AND 30/);
 assert.match(sql,/array_position\(p_case_ids,NULL\)/);
 assert.match(sql,/count\(DISTINCT id\)/);
});
test('V168 locks case rows in stable UUID order',()=>{
 assert.match(sql,/unnest\(p_case_ids\) AS x\(id\) ORDER BY x\.id/);
 assert.match(sql,/WHERE id=v_case_id FOR UPDATE/);
});
test('V168 every case requires an independent approval in authorized state',()=>{
 assert.match(sql,/v_case.status IS DISTINCT FROM 'authorized'/);
 assert.match(sql,/v_case.approved_by IS NULL/);
 assert.match(sql,/v_case.approved_by IS NOT DISTINCT FROM v_case.requested_by/);
});
test('V168 rejects mixes of different decrees, parishes and dioceses',()=>{
 assert.match(sql,/v_case.decree_id IS DISTINCT FROM v_decree_id/);
 assert.match(sql,/v_case.parish_id IS DISTINCT FROM v_parish_id/);
 assert.match(sql,/v_case.diocese_id IS DISTINCT FROM v_diocese_id/);
});
test('V168 decree must be active, scoped and appropriate sacrament',()=>{
 assert.match(sql,/v_decree.status IS DISTINCT FROM 'active'/);
 for(const sacrament of ["'bautismo'","'confirmacion'","'matrimonio'","'exequias'"])
  assert.ok(sql.includes(sacrament),sacrament);
});
test('V168 stale or mandatory marginal notes cannot be reconciled',()=>{
 for(const clause of ["to_jsonb(v_note) IS DISTINCT FROM v_case.note_snapshot",
  "v_note.status IS DISTINCT FROM 'active'",
  "v_note.decree_id IS NOT NULL",
  "v_note.is_locked IS DISTINCT FROM false",
  "v_note.print_policy IS DISTINCT FROM 'optional'"])
  assert.ok(sql.includes(clause),clause);
});
test('V168 no uncovered active later notes or pending cases',()=>{
 assert.match(sql,/Existen otras solicitudes abiertas/);
 assert.match(sql,/Hay notas marginales posteriores fuera del lote/);
});
test('V168 one decree reversal for each sacrament class',()=>{
 assert.match(sql,/reverse_correction_decree_with_reason/);
 assert.match(sql,/reverse_replacement_decree_with_reason/);
 assert.match(sql,/reverse_marriage_decree/);
 assert.match(sql,/reverse_funeral_decree/);
});
test('V168 expects all case updates and consolidates one official notification',()=>{
 assert.match(sql,/GET DIAGNOSTICS v_updated=ROW_COUNT/);
 assert.match(sql,/v_updated<>v_case_count/);
 assert.equal((sql.match(/INSERT INTO public\.official_notifications/g)||[]).length,1);
 assert.match(sql,/reconciliation_case_ids/);
});
test('V168 auditing preserves every individual case and note history',()=>{
 assert.match(sql,/manual_note_reconciled_before_decree_reversal/);
 assert.match(sql,/reconciliation_executed/);
 assert.match(sql,/authorization_reference/);
});
test('V168 never directly grants RPC to anon',()=>{
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.match(sql,/TO authenticated/);
 assert.doesNotMatch(sql,/GRANT EXECUTE[\s\S]*TO anon;/);
});
test('V168 first QA executes positive batch, seven denials, exact audit/notification',()=>{
 assert.match(one,/v168.*batch|V168/i);
 assert.match(one,/ARRAY\[k1,k2\]/);
 assert.match(one,/IF denied<>7/);
 assert.match(one,/IF count_actual<>6/);
 assert.match(one,/IF count_actual<>1/);
});
test('V168 four-scarament QA covers two notes per each decree, all rollback',()=>{
 for(const s of ["'bautismo'","'confirmacion'","'matrimonio'","'exequias'"])
   assert.ok(four.includes(s),s);
 assert.match(four,/execute_later_note_reconciliation_batch_v168/);
 assert.match(four,/note2/);
 assert.match(four,/v_audits<>6/);
 assert.match(four,/v_notices<>1/);
 assert.match(four,/ROLLBACK;\s*$/);
});
test('V168 QA never commits fictitious records',()=>{
 for(const source of [one,four]){
  assert.match(source,/^BEGIN;$/m);
  assert.doesNotMatch(source,/^\s*COMMIT\b/im);
 }
});
test('V168 service calls only versioned privileged batch RPC',()=>{
 assert.match(service,/executeLaterNoteReconciliationBatch = \(caseIds\)/);
 assert.match(service,/rpc\('execute_later_note_reconciliation_batch_v168',\{p_case_ids:caseIds\}\)/);
});
test('V168 UI groups only authorized cases from the same decree',()=>{
 assert.match(page,/caseItem.status==='authorized'/);
 assert.match(page,/by\[caseItem.decree_id\]/);
 assert.match(page,/new Set\(group.map\(x=>x.decree_id\)\).size!==1/);
});
test('V168 UI requires fully loaded authorized list to avoid incomplete batches',()=>{
 assert.match(page,/statusFilter==='authorized' && !hasMore && !loading && !loadingMore/);
 assert.match(page,/Cargar 50 expedientes anteriores/);
});
test('V168 UX confirms batch irreversibility before RPC',()=>{
 assert.match(page,/title:'Conciliar varias notas autorizadas'/);
 assert.match(page,/confirmText:'Ejecutar conciliación conjunta'/);
 assert.match(page,/await executeLaterNoteReconciliationBatch\(group.map\(x=>x.id\)\)/);
});
test('V168 UI never publishes stale feedback after identity switching',()=>{
 assert.match(page,/currentIdentityRef=useRef\(identityKey\)/);
 assert.match(page,/scopeAtStart!==currentIdentityRef.current/);
});
