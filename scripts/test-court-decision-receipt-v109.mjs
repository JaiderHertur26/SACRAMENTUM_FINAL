import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261022014929_court_decision_receipt_unverified_v109.sql'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/pages/chancery/SacramentalDecreeArchivePage.jsx'),'utf8');

test('Constancia vinculada a caso, sentencia, diócesis y parroquia',()=>{
 for(const token of ['review_case_id uuid NOT NULL REFERENCES','nullity_decree_id uuid NOT NULL REFERENCES','diocese_id uuid NOT NULL REFERENCES','parish_id uuid NOT NULL REFERENCES'])
  assert.ok(sql.includes(token));
});
test('El resultado se denomina declarado, nunca definitivo o ejecutado',()=>{
 assert.match(sql,/reported_outcome text NOT NULL/);
 assert.match(sql,/issuing_authority_reported text NOT NULL/);
});
test('Solo tres categorías informativas de lo recibido',()=>{
 for(const x of ['maintains_nullity','orders_further_review','claims_rectification'])assert.ok(sql.includes(x));
 assert.doesNotMatch(sql,/'execute_revocation'|'restore_marriage'/);
});
test('Todo documento comienza sin verificación jurídica',()=>{
 assert.match(sql,/verification_state text NOT NULL DEFAULT 'unverified'/);
 assert.match(sql,/CHECK \(verification_state='unverified'\)/);
});
test('La constancia no acredita autenticidad ni ejecución',()=>{
 assert.match(sql,/receipt_only_no_authenticity_or_effects/);
 assert.match(sql,/'document_authenticity_verified',false/);
 assert.match(sql,/'court_decision_executed',false/);
});
test('La constancia exige referencia, Tribunal y descripción sustancial',()=>{
 assert.match(sql,/length\(trim\(issuing_authority_reported\)\) >= 8/);
 assert.match(sql,/length\(trim\(court_document_reference\)\) >= 8/);
 assert.match(sql,/length\(trim\(received_summary\)\) >= 50/);
});
test('Fechas futuras se rechazan por servidor',()=>{
 assert.match(sql,/p_court_document_date>CURRENT_DATE/);
});
test('Se prohíbe repetir la misma referencia por expediente',()=>{
 assert.match(sql,/UNIQUE\(review_case_id,court_document_reference\)/);
});
test('RLS habilitado sin escritura directa',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.nullity_court_decision_receipts FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.nullity_court_decision_receipts TO authenticated/);
});
test('RLS diocesana/parroquial delimita visibilidad',()=>{
 assert.match(sql,/current_app_role\(\) IN \('chancery','diocese'\)/);
 assert.match(sql,/diocese_id=public\.current_app_diocese_id\(\)/);
 assert.match(sql,/parish_id=public\.current_app_parish_id\(\)/);
});
test('La RPC exige sesión activa y perfil Cancillería',()=>{
 assert.match(sql,/auth\.uid\(\) IS NULL/);
 assert.match(sql,/coalesce\(up\.is_active,false\)/);
 assert.match(sql,/v_role IS DISTINCT FROM 'chancery'/);
});
test('El caso se bloquea para evitar carreras',()=>{
 assert.match(sql,/WHERE id=p_review_case_id FOR UPDATE/);
 assert.match(sql,/v_case\.status<>'under_legal_review'/);
});
test('La fuente judicial original se revisa con locks de lectura',()=>{
 assert.match(sql,/WHERE id=v_case\.nullity_decree_id FOR SHARE/);
 assert.match(sql,/WHERE id=v_case\.marriage_id FOR SHARE/);
});
test('Jurisdicción e identidad de sentencia y matrimonio son consistentes',()=>{
 for(const x of [
  'v_case.diocese_id IS DISTINCT FROM v_diocese',
  'v_parish_diocese IS DISTINCT FROM v_diocese',
  'v_decree.original_record_id IS DISTINCT FROM v_case.marriage_id',
  'v_marriage.parish_id IS DISTINCT FROM v_case.parish_id'])
   assert.ok(sql.includes(x));
});
test('Requiere sentencia vigente de nulidad matrimonial',()=>{
 assert.match(sql,/v_decree\.tipo<>'nulidad_matrimonial'/);
 assert.match(sql,/v_decree\.sacrament_type<>'matrimonio'/);
 assert.match(sql,/NOT IN \('active','vigente'\)/);
});
test('Requiere inicio de estudio previo formal',()=>{
 assert.match(sql,/v_event_count<>1/);
 assert.match(sql,/e\.action='start_review'/);
});
test('No modifica partidas, decretos, notas ni acuses',()=>{
 assert.doesNotMatch(sql,/^\s*UPDATE\s+public\.(?:marriages|decretos|baptisms|marginal_notes|matrimonial_notifications)/im);
 assert.doesNotMatch(sql,/^\s*DELETE\s+FROM\s+public\./im);
});
test('La operación es append only con auditoría',()=>{
 assert.match(sql,/INSERT INTO public\.nullity_court_decision_receipts/);
 assert.match(sql,/INSERT INTO public\.registry_audit_log/);
 assert.match(sql,/'receipt_unverified'/);
});
test('RPC denegada a anon y PUBLIC',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.register_nullity_court_decision_receipt_v109/);
 assert.match(sql,/FROM PUBLIC,anon/);
});
test('Interfaz muestra y registra comunicaciones sin atribuir autenticidad',()=>{
 assert.match(ui,/Registrar decisión recibida \(sin verificar\)/);
 assert.match(ui,/register_nullity_court_decision_receipt_v109/);
 assert.match(ui,/NO VERIFICADA/);
 assert.match(ui,/No produce efectos registrales/);
});
test('Solo deja añadir decisiones a una revisión abierta',()=>{
 assert.match(ui,/review\?\.status !== 'under_legal_review'/);
 assert.match(ui,/nullityReviews\[row\.id\]\?\.status === 'under_legal_review'/);
});
test('El formulario confirma que no altera registros',()=>{
 assert.match(ui,/No confirma autenticidad ni autoriza revocación/);
 assert.match(ui,/no se ha cambiado el estado de ninguna partida/);
});
test('El historial presenta el resumen escapado por React',()=>{
 assert.match(ui,/\{receipt\.received_summary\}/);
 assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
});

const dioceseUi=fs.readFileSync(path.join(root,'src/pages/diocese/DiocesanDecreeOversightPage.jsx'),'utf8');
const parishUi=fs.readFileSync(path.join(root,'src/pages/parish/ParishSacramentalDecreeArchivePage.jsx'),'utf8');
test('Diócesis consulta decisiones declaradas sin verificar en solo lectura',()=>{
 assert.match(dioceseUi,/from\('nullity_court_decision_receipts'\)/);
 assert.match(dioceseUi,/eq\('diocese_id',dioceseId\)/);
 assert.match(dioceseUi,/documento\(s\) de decisión recibidos · SIN VERIFICAR/);
});
test('Parroquia consulta exclusivamente decisiones de su jurisdicción',()=>{
 assert.match(parishUi,/from\('nullity_court_decision_receipts'\)/);
 assert.match(parishUi,/eq\('parish_id',user\.parishId\)/);
 assert.match(parishUi,/documento\(s\) recibidos · SIN VERIFICAR/);
});
test('Los otros dos roles no reciben botón de aprobación ni ejecución',()=>{
 for(const code of [dioceseUi,parishUi]){
  assert.doesNotMatch(code,/register_nullity_court_decision_receipt_v109/);
  assert.doesNotMatch(code,/approve_nullity_revocation/);
 }
});
