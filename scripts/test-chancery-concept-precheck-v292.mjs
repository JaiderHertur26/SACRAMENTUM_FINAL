import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const sql=read('supabase/migrations/20261029032959_sacramentum_v292_chancery_concept_approval_preflight.sql');
const service=read('src/services/issueDecreeFromFullFormV287.js');
const ui=read('src/components/chancery/ChanceryConceptApprovalStatusV292.jsx');
test('V292 no concede aprobación, es una consulta previa aislada a Cancillería',()=>{
 assert.match(sql,/CREATE FUNCTION public\.check_chancery_decree_concept_v292/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/up\.auth_user_id=a AND up\.role='chancery'/);
 assert.match(sql,/s\.policy_snapshot=jsonb_build_object/);
 assert.match(sql,/s\.approved_by IS NOT NULL/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.doesNotMatch(sql,/\bINSERT\s+INTO\b|\bUPDATE\s+public\.|\bDELETE\s+FROM\b/i);
});
test('V292 impide crear una memoria pendiente antes de comprobar la autorización',()=>{
 const i=service.indexOf('const authorization=await checkChanceryDecreeConceptV292');
 const j=service.indexOf("supabase.rpc('issue_chancery_form_decree_v287'");
 assert.ok(i>0 && j>i);
 assert.match(service,/if\(authorization\.approved!==true\)/);
 assert.match(service,/p_sacrament:sacrament,p_decree_type:type/);
});
for(const [p,sac] of [
 ['decree-correction/NewDecreeCorrectionPage.jsx','bautismo'],
 ['decree-correction/NewConfirmationCorrectionPage.jsx','confirmacion']
]){
 test('V292 pantalla '+sac+' consulta aprobación antes del botón',()=>{
  const src=read('src/pages/chancery/'+p);
  assert.match(src,/ChanceryConceptApprovalStatusV292/);
  assert.match(src,/!conceptApproved \|\| isLoading/);
  assert.match(src,new RegExp('sacrament="'+sac+'" type="correccion"'));
  assert.match(src,/Expedir corrección y notificar a la parroquia/);
  assert.doesNotMatch(src,/Emitir Corrección y Crear Partida Supletoria/);
 });
}
test('V292 pantalla explica responsable e incluye recarga de aprobación',()=>{
 assert.match(ui,/rol Diócesis/);
 assert.match(ui,/Archivo diocesano de decretos/);
 assert.match(ui,/Comprobar autorización/);
 assert.doesNotMatch(ui,/approve_decree_concept_for_new_seat_v282/);
});
test('V292 los seis formularios usan texto fiel a emisión sin asiento',()=>{
 const pages=['decree-correction/NewDecreeCorrectionPage.jsx',
  'decree-correction/NewConfirmationCorrectionPage.jsx',
  'decree-replacement/NewDecreeReplacementPage.jsx',
  'decree-replacement/NewConfirmationReplacementPage.jsx',
  'marriage/MarriageDecreesPage.jsx','exequias/FuneralDecreesPage.jsx'];
 for(const p of pages){
  const s=read('src/pages/chancery/'+p);
  assert.match(s,/issueDecreeFromFullFormV287/);
  assert.doesNotMatch(s,/Emitir (Corrección|Reposición) y Crear Partida Supletoria/);
 }
});
test('V292 no altera control de Diócesis; autorización requiere rol y referencia',()=>{
 const diocese=read('src/components/chancery/DiocesanNewDecreeConceptApprovalV282.jsx');
 assert.match(diocese,/p_authorization_reference:ref/);
 assert.match(diocese,/user\?\.role!=='diocese'/);
 const rpc=read('scripts/v282-diocese-new-seat-concept-approval.sql');
 assert.match(rpc,/up\.role='diocese'/);
 assert.match(rpc,/length\(ref\) NOT BETWEEN 8 AND 120/);
});
