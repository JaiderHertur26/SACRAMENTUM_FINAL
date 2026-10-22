import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261022012910_track_nullity_court_correspondence_v108.sql'),'utf8');
const chancery=fs.readFileSync(path.join(root,'src/pages/chancery/SacramentalDecreeArchivePage.jsx'),'utf8');
const diocese=fs.readFileSync(path.join(root,'src/pages/diocese/DiocesanDecreeOversightPage.jsx'),'utf8');
const parish=fs.readFileSync(path.join(root,'src/pages/parish/ParishSacramentalDecreeArchivePage.jsx'),'utf8');

test('Tabla de actuaciones vincula caso, sentencia y diócesis',()=>{
 for(const text of ['review_case_id uuid NOT NULL REFERENCES','nullity_decree_id uuid NOT NULL REFERENCES','diocese_id uuid NOT NULL REFERENCES','parish_id uuid NOT NULL REFERENCES']){
   assert.ok(sql.includes(text));
 }
});
test('Solo dos actuaciones no dispositivas',()=>{
 assert.match(sql,/CHECK\(action IN \('start_review','record_court_correspondence'\)\)/);
 assert.doesNotMatch(sql,/'execute_reversal'|'revoke_sentence'|'restore_marriage'/);
});
test('Documentos y explicaciones sustantivas, sin fechas futuras',()=>{
 assert.match(sql,/char_length\(trim\(document_reference\)\)>=8/);
 assert.match(sql,/char_length\(trim\(record_description\)\)>=30/);
 assert.match(sql,/document_date<=CURRENT_DATE/);
});
test('Restricción de referencia duplicada atómica',()=>{
 assert.match(sql,/UNIQUE \(review_case_id,action,document_reference\)/);
});
test('RLS habilitada sin escritura directa',()=>{
 assert.match(sql,/ALTER TABLE public\.nullity_judicial_review_events ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.nullity_judicial_review_events FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.nullity_judicial_review_events TO authenticated/);
});
test('RLS de lectura aplica rol y jurisdicción',()=>{
 assert.match(sql,/current_app_role\(\) IN \('chancery','diocese'\)/);
 assert.match(sql,/diocese_id=public\.current_app_diocese_id\(\)/);
 assert.match(sql,/parish_id=public\.current_app_parish_id\(\)/);
});
test('RPC se ejecuta como usuario autenticado con perfil activo',()=>{
 assert.match(sql,/auth\.uid\(\) IS NULL/);
 assert.match(sql,/coalesce\(up\.is_active,false\)=true/);
 assert.match(sql,/v_role IS DISTINCT FROM 'chancery'/);
});
test('RPC solo jurisdicción actual y sentencia original',()=>{
 assert.match(sql,/v_case\.diocese_id IS DISTINCT FROM v_diocese/);
 assert.match(sql,/v_parish_diocese IS DISTINCT FROM v_diocese/);
 assert.match(sql,/v_decree\.original_record_id IS DISTINCT FROM v_case\.marriage_id/);
});
test('Revisión bloqueada si sentencia no vigente o distinta de nulidad',()=>{
 assert.match(sql,/v_decree\.tipo<>'nulidad_matrimonial'/);
 assert.match(sql,/NOT IN \('active','vigente'\)/);
});
test('Transiciones de estado controladas y expediente bloqueado FOR UPDATE',()=>{
 assert.match(sql,/WHERE id=p_review_case_id FOR UPDATE/);
 assert.match(sql,/p_action='start_review' AND v_case\.status<>'pending_review'/);
 assert.match(sql,/p_action='record_court_correspondence' AND v_case\.status<>'under_legal_review'/);
});
test('Iniciar estudio es la única actualización de expediente',()=>{
 assert.match(sql,/IF p_action='start_review' THEN\s+UPDATE public\.nullity_judicial_review_cases/);
 assert.match(sql,/SET status='under_legal_review'/);
});
test('Actuaciones apéndice no reemplazan registros anteriores',()=>{
 assert.match(sql,/INSERT INTO public\.nullity_judicial_review_events/);
 assert.doesNotMatch(sql,/^\s*DELETE\s+FROM\s+public\./im);
 assert.doesNotMatch(sql,/^\s*UPDATE public\.nullity_judicial_review_events/im);
});
test('Ninguna partida, sentencia, nota o aviso se actualiza directamente',()=>{
 assert.doesNotMatch(sql,/^\s*(?:UPDATE|DELETE\s+FROM)\s+public\.(?:decretos|marriages|baptisms|marginal_notes|matrimonial_notifications)/im);
});
test('Se documenta que la autenticidad judicial no está verificada',()=>{
 assert.match(sql,/'document_authenticity_verified',false/);
 assert.match(sql,/'decree_or_sacrament_modified',false/);
 assert.match(sql,/'court_resolution_executed',false/);
});
test('RPC bloqueada a anónimos y disponible para authenticated con guarda interna',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.record_nullity_judicial_review_step_v108/);
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.match(sql,/TO authenticated/);
});
test('Cancillería puede comenzar estudio y registrar comunicaciones',()=>{
 assert.match(chancery,/recordNullityReviewStep/);
 assert.match(chancery,/p_action: action/);
 assert.match(chancery,/'start_review' : 'record_court_correspondence'/);
});
test('Interfaz exige número, fecha y explicación; confirma ausencia de efectos',()=>{
 assert.match(chancery,/p_document_reference: docReference\.trim\(\)/);
 assert.match(chancery,/p_document_date: isoDate/);
 assert.match(chancery,/p_record_description: description\.trim\(\)/);
 assert.match(chancery,/no altera la sentencia, el Matrimonio, los Bautismos, las notas marginales ni los acuses/);
});
test('Cancillería muestra el historial completo sin texto HTML sin sanear',()=>{
 assert.match(chancery,/Ver actuaciones/);
 assert.match(chancery,/reviewEvents\[nullityReviews\[row\.id\]\.id\]/);
 assert.match(chancery,/\{event\.record_description\}/);
 assert.doesNotMatch(chancery,/dangerouslySetInnerHTML/);
});
test('Diócesis y Parroquia distinguen solicitud pendiente de estudio activo',()=>{
 for(const source of [diocese,parish]){
  assert.match(source,/status === 'under_legal_review'/);
  assert.match(source,/En estudio jurídico/);
 }
});
test('No existen botones de ejecución de sentencia en el archivo',()=>{
 assert.doesNotMatch(chancery,/rpc\('reverse_nullity_sentence'/);
 assert.doesNotMatch(chancery,/rpc\('execute_nullity_revocation'/);
});
