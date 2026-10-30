import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const sql=read('supabase/deployment/v318_shared_sacramental_notification_sequence.sql');
const qa=read('scripts/qa-rollback-sincronizacion-matrimonio-confirmacion-v318.sql');
test('V318 consagra secuencia única por parroquia para dos notificaciones',()=>{
 assert.match(sql,/next_sacramental_case_sequence_v318\(v_sender/);
 assert.match(sql,/sacramental_case_global_v318/);
 assert.match(sql,/CASE WHEN p_sacrament='matrimonio' THEN 'NM' ELSE 'NCF'/);
 assert.doesNotMatch(sql,/FROM public\.next_document_sequence\(v_sender/);
});
test('V318 serializa emisiones contra los registros anteriores y respeta máximo existente',()=>{
 assert.match(sql,/LOCK TABLE public\.matrimonial_notifications IN SHARE ROW EXCLUSIVE MODE/);
 assert.match(sql,/coalesce\(max\(n\.consecutive\),0\)/);
 assert.match(sql,/greatest\(public\.document_sequences\.current_value,EXCLUDED\.current_value-1\)\+1/);
});
test('V318 restringe asignación al párroco activo de su parroquia',()=>{
 assert.match(sql,/u\.auth_user_id=v_actor AND u\.role='parish'/);
 assert.match(sql,/u\.parish_id=p_parish_id AND u\.diocese_id=p\.diocese_id/);
 assert.match(sql,/p\.is_operational IS TRUE/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.next_sacramental_case_sequence_v318/);
});
test('V318 QA usa dos personas en Matrimonio y una en Confirmación con reversión absoluta',()=>{
 assert.match(qa,/issue_sacramental_case_v277\('matrimonio'/);
 assert.equal((qa.match(/issue_sacramental_case_v277\('confirmacion'/g)||[]).length,2);
 assert.match(qa,/duplicate_notices_denied/);
 assert.match(qa,/premature_closure_denied/);
 assert.match(qa,/^BEGIN;/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\s*;/im);
});
