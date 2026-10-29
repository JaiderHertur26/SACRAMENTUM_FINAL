import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const sql=read('supabase/migrations/20261029034915_sacramentum_v293_chancery_role_authorized_no_diocese_concept_gate.sql');
test('V293 no exige un visto bueno nuevo en la emisión ni en el catálogo visible',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.issue_chancery_decree_v280/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.get_chancery_decree_issue_context_v280/);
 assert.doesNotMatch(sql,/supplementary_concept_approvals_v272|falta aprobación diocesana/);
 assert.match(sql,/DROP FUNCTION IF EXISTS public\.check_chancery_decree_concept_v292/);
});
test('V293 conserva controles de Cancillería, jurisdicción, vigencia y clase de concepto',()=>{
 assert.match(sql,/up\.role='chancery'/);
 assert.match(sql,/up\.auth_user_id=a/);
 assert.match(sql,/p\.diocese_id=di AND p\.is_operational/);
 assert.match(sql,/WHERE id=p_concept_id AND diocese_id=di AND is_active IS TRUE/);
 assert.match(sql,/c\.seinscribe IS DISTINCT FROM TRUE OR c\.enlibro<>2/);
 assert.match(sql,/p_decree_type='correccion'/);
 assert.match(sql,/p_decree_type='reposicion'/);
});
test('V293 crea aviso pendiente sin Libro, Folio ni Número nuevos',()=>{
 assert.match(sql,/INSERT INTO public\.official_notifications/);
 assert.match(sql,/seatBook',null,'seatFolio',null,'seatNumber',null/);
 assert.match(sql,/physicalCoordinatesAssigned',false/);
 assert.doesNotMatch(sql,/INSERT INTO public\.(baptisms|marriages|confirmations|funerals)/);
});
for(const f of ['src/pages/chancery/decree-correction/NewDecreeCorrectionPage.jsx',
'src/pages/chancery/decree-correction/NewConfirmationCorrectionPage.jsx']){
 test('V293 sin pantalla de autorización diocesana adicional '+f,()=>{
  const s=read(f);
  assert.doesNotMatch(s,/ChanceryConceptApprovalStatusV292|conceptApproved/);
  assert.match(s,/Expedir corrección y notificar a la parroquia/);
 });
}
test('V293 panel diocesano redundante oculto y concepto visible por jurisdicción',()=>{
 const d=read('src/pages/diocese/DiocesanDecreeOversightPage.jsx');
 const c=read('src/components/chancery/ChanceryDecreeIssueV280.jsx');
 assert.doesNotMatch(d,/DiocesanNewDecreeConceptApprovalV282/);
 assert.doesNotMatch(c,/Seleccione concepto aprobado por Diócesis|Ambos exigen concepto supletorio autorizado/);
 assert.match(c,/Concepto eclesiástico vigente/);
});
test('V293 migración no altera partidas existentes ni expone nuevo SQL',()=>{
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path TO ''/);
 assert.doesNotMatch(sql,/^\s*TRUNCATE\s+TABLE\b/gmi);
 assert.match(sql,/^CREATE OR REPLACE FUNCTION public\.issue_chancery_decree_v280/m);
});
