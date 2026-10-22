import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const get=f=>fs.readFileSync(f,'utf8');
const v128=get('supabase/migrations/20261022150317_pre_execution_nullity_institutional_review_v128.sql');
const v129=get('supabase/migrations/20261022150555_fix_nullity_preflight_audit_concatenation_v129.sql');
const v130=get('supabase/migrations/20261022150728_scoped_nullity_preflight_list_v130.sql');
const lab=get('scripts/qa-rollback-nullity-dual-authorization-v128.sql');
const scope=get('scripts/qa-rollback-nullity-preflight-read-scope-v130.sql');
const original=get('scripts/qa-rollback-nullity-without-preauthorization-v128.sql');
const ui=get('src/components/chancery/NullityInstitutionalPreflightPanel.jsx');
const service=get('src/services/nullityInstitutionalPreflightService.js');
const chancery=get('src/pages/chancery/SacramentalDecreesCenterPage.jsx');
const diocese=get('src/pages/diocese/DiocesanDecreeOversightPage.jsx');

test('V128 guarda expediente de revisión con identificador, partes, documentos y hash',()=>{
 for(const x of ['marriage_id uuid NOT NULL','parish_id uuid NOT NULL','diocese_id uuid NOT NULL',
  'court_document_reference text NOT NULL','court_document_sha256 text NOT NULL',
  'requested_by uuid NOT NULL','reviewed_by uuid','executed_by uuid','decree_id uuid'])
  assert.ok(v128.includes(x),x);
});
test('V128 no concede acceso directo a la tabla por cliente',()=>{
 assert.match(v128,/ENABLE ROW LEVEL SECURITY/);
 assert.match(v128,/REVOKE ALL ON public.nullity_execution_authorizations_v128 FROM PUBLIC,anon,authenticated/);
});
test('V128 limita solicitud a Cancillería activa de la diócesis propietaria',()=>{
 assert.match(v128,/v_role IS DISTINCT FROM 'chancery'/);
 assert.match(v128,/v_parish_diocese IS DISTINCT FROM v_diocese/);
 assert.match(v128,/lower\(coalesce\(v_marriage.status,''\)\) NOT IN \('seated','active','vigente'\)/);
});
test('V128 sólo admite revisión independiente desde Diócesis',()=>{
 assert.match(v128,/v_role IS DISTINCT FROM 'diocese'/);
 assert.match(v128,/v_auth.requested_by IS NOT DISTINCT FROM v_actor/);
 assert.match(v128,/p_decision NOT IN \('authorize','reject'\)/);
 assert.match(v128,/v_auth.status<>'pending_diocesan_review'/);
});
test('V128 impide ejecutar nulidad sin autorización específica',()=>{
 const rpc=v128.slice(v128.indexOf('CREATE OR REPLACE FUNCTION public.apply_marriage_nullity'));
 assert.match(rpc,/preExecutionAuthorizationId/);
 assert.match(rpc,/v_authorization.status <> 'authorized'/);
 assert.match(rpc,/v_authorization.marriage_id is distinct from p_marriage_id/);
 assert.match(rpc,/v_authorization.decree_date is distinct from p_decree_date/);
 assert.match(rpc,/v_authorization.parish_id is distinct from v_marriage.parish_id/);
 assert.ok(rpc.indexOf("v_authorization.status <> 'authorized'")<rpc.indexOf('update public.marriages'));
});
test('V128 sólo consume autorización después de crear decreto y notas',()=>{
 const rpc=v128.slice(v128.indexOf('CREATE OR REPLACE FUNCTION public.apply_marriage_nullity'));
 assert.match(rpc,/set status='executed',executed_by=auth.uid\(\),executed_at=now\(\),decree_id=v_decree_id/);
 assert.ok(rpc.indexOf('insert into public.decretos(')<rpc.indexOf("set status='executed'"));
});
test('V128 no transforma revisión interna en certificación judicial',()=>{
 assert.match(v128,/court_authenticity_certified',false/);
 assert.match(v128,/'courtAuthenticityCertified',false/);
 assert.match(v128,/documentary_preflight_not_court_authenticity_certification/);
});
test('V129 corrige bitácora y mantiene verificación de rol',()=>{
 assert.match(v129,/'diocesan_'\|\|v_status/);
 assert.match(v129,/v_role IS DISTINCT FROM 'diocese'/);
});
test('V130 consulta permite sólo Cancillería y Diócesis',()=>{
 assert.match(v130,/v_role NOT IN \('chancery','diocese'\)/);
 assert.match(v130,/a.diocese_id=v_diocese/);
 assert.match(v130,/LIMIT 200/);
 assert.match(v130,/REVOKE ALL ON FUNCTION .* FROM PUBLIC,anon/);
});
test('Matriz real ficticia prueba cuatro roles y once denegaciones',()=>{
 for(const role of ["'admin_general'","'diocese'","'parish'","'chancery'"])assert.ok(lab.includes(role));
 assert.match(lab,/v_denied<>13/);
 assert.match(lab,/preExecutionAuthorizationId/);
 assert.match(lab,/status='executed' AND decree_id=v_decree/);
});
for(const [name,sql] of [['reproducción',original],['integral',lab],['lectura',scope]]){
 test(name+' siempre es reversible, sin COMMIT',()=>{
  assert.match(sql,/^BEGIN;$/m);assert.match(sql,/ROLLBACK;\s*$/);
  assert.doesNotMatch(sql,/^\s*COMMIT\b/im);
 });
}
test('Servicio usa únicamente RPC institucionales y no edita tablas',()=>{
 for(const name of ['list_marriage_nullity_execution_v130','request_marriage_nullity_execution_v128',
   'review_marriage_nullity_execution_v128','apply_marriage_nullity'])assert.ok(service.includes("'"+name+"'"));
 assert.doesNotMatch(service,/\.from\('(?:decretos|marriages)'\)\.(?:update|delete|insert)/);
});
test('Interfaz requiere documento y confirmaciones expresas',()=>{
 assert.match(ui,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(ui,/SOLICITAR/);assert.match(ui,/EJECUTAR NULIDAD/);
 assert.match(ui,/custodie el documento judicial auténtico/);
});
test('Interfaz compartida sólo se monta en Cancillería y Diócesis',()=>{
 assert.match(chancery,/import NullityInstitutionalPreflightPanel/);
 assert.match(diocese,/import NullityInstitutionalPreflightPanel/);
 assert.match(chancery,/<NullityInstitutionalPreflightPanel/);
 assert.match(diocese,/<NullityInstitutionalPreflightPanel/);
 assert.match(ui,/role === 'chancery' \|\| role === 'diocese'/);
});

test('V130 consulta multijurisdiccional real tiene datos falsos de dos diócesis y ROLLBACK',()=>{
 const sql=get('scripts/qa-rollback-nullity-preflight-cross-diocese-v130.sql');
 assert.match(sql,/QA-V130-DIOCESIS-FICTICIA-AJENA/);
 assert.match(sql,/v_scope @> jsonb_build_array\(jsonb_build_object\('id',v_auth_foreign\)\)/);
 assert.match(sql,/NOT v_scope @> jsonb_build_array\(jsonb_build_object\('id',v_auth_local\)\)/);
 assert.match(sql,/ROLLBACK;\s*$/);
 assert.doesNotMatch(sql,/^\s*COMMIT;/im);
});

test('V132 deshabilita el procedimiento diocesano antiguo y exige huella concordante en backend',()=>{
 const sql=get('supabase/migrations/20261022153516_require_verified_document_hash_for_nullity_v132.sql');
 assert.match(sql,/El procedimiento anterior se deshabilitó/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.review_marriage_nullity_execution_v128\(uuid,text,text,text\)/);
 assert.match(sql,/p_verified_sha256 text/);
 assert.match(sql,/lower\(btrim\(coalesce\(p_verified_sha256,''\)\)\) IS DISTINCT FROM v_auth.court_document_sha256/);
 assert.match(sql,/document_sha256_correspondence/);
 assert.match(sql,/court_authenticity_certified',false/);
});
test('V132 la interfaz exige copia real del documento antes de habilitar autorización',()=>{
 assert.match(ui,/verifyReviewCopy/);
 assert.match(ui,/crypto.subtle.digest\('SHA-256'/);
 assert.match(ui,/disabled=\{busy\|\|!reviewedDocuments\[row.id\]\?\.matches\}/);
 assert.match(ui,/DOCUMENTO DIFERENTE/);
 assert.match(ui,/verifiedDocumentHash:decision==='authorize'\?reviewedDocuments\[row.id\]\?\.digest:null/);
 assert.match(service,/p_verified_sha256:/);
});
test('La matriz V132 rechaza la ruta antigua, la huella distinta y conserva rechazo',()=>{
 assert.match(lab,/V132-FAIL: revisión legacy con cuatro parámetros aceptada/);
 assert.match(lab,/V132-FAIL: huella SHA-256 incorrecta aceptada/);
 assert.match(lab,/repeat\('0',64\)/);
 assert.match(lab,/repeat\('a',64\)/);
 assert.match(lab,/v_denied<>13/);
});
