import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261022005935_nullity_judicial_review_intake_v107.sql'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/pages/chancery/SacramentalDecreeArchivePage.jsx'),'utf8');

test('El expediente de revisión tiene identificador y vínculos originales',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.nullity_judicial_review_cases/);
 for(const key of ['nullity_decree_id','marriage_id','diocese_id','parish_id','authority_document_reference','requested_by']){
  assert.ok(sql.includes(key));
 }
});
test('El estado inicial NO se llama revocación ni sentencia anulada',()=>{
 assert.match(sql,/DEFAULT 'pending_review'/);
 assert.doesNotMatch(sql,/DEFAULT '(?:reversed|revoked|annulled)'/);
});
test('Un solo expediente abierto por sentencia mediante índice único parcial',()=>{
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS uq_nullity_review_open_decree_v107/);
 assert.match(sql,/status IN \('pending_review','under_legal_review'\)/);
});
test('Tabla con RLS y sin permisos DML del usuario',()=>{
 assert.match(sql,/ALTER TABLE public\.nullity_judicial_review_cases ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.nullity_judicial_review_cases FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public\.nullity_judicial_review_cases TO authenticated/);
});
test('Lectura regional solo Cancillería, Diócesis y Parroquia propietaria',()=>{
 assert.match(sql,/current_app_role\(\) IN \('chancery','diocese'\)/);
 assert.match(sql,/diocese_id=public\.current_app_diocese_id\(\)/);
 assert.match(sql,/current_app_role\(\)='parish'/);
 assert.match(sql,/parish_id=public\.current_app_parish_id\(\)/);
});
test('La escritura RPC exige rol Cancillería activo y sesión',()=>{
 assert.match(sql,/IF auth\.uid\(\) IS NULL/);
 assert.match(sql,/v_role IS DISTINCT FROM 'chancery'/);
 assert.match(sql,/coalesce\(up\.is_active,false\)/);
});
test('Decreto debe ser nulidad matrimonial vigente',()=>{
 assert.match(sql,/v_decree\.tipo <> 'nulidad_matrimonial'/);
 assert.match(sql,/v_decree\.sacrament_type <> 'matrimonio'/);
 assert.match(sql,/NOT IN \('active','vigente'\)/);
});
test('Bloqueo territorial con jurisdicción actual y decreto',()=>{
 assert.match(sql,/v_decree\.diocese_id IS DISTINCT FROM v_user_diocese/);
 assert.match(sql,/v_actual_diocese IS DISTINCT FROM v_user_diocese/);
});
test('Correspondencia entre Matrimonio original y sentencia',()=>{
 assert.match(sql,/id=v_decree\.original_record_id FOR SHARE/);
 assert.match(sql,/v_marriage\.parish_id IS DISTINCT FROM v_decree\.parish_id/);
});
test('Motivación y referencias sustantivas obligatorias',()=>{
 assert.match(sql,/char_length\(trim\(coalesce\(p_review_reason,''\)\)\) < 30/);
 assert.match(sql,/char_length\(trim\(coalesce\(p_authority_document_reference,''\)\)\) < 8/);
});
test('Contadores de avisos, recepciones y notas como evidencia',()=>{
 assert.match(sql,/'notifications',v_notice_count/);
 assert.match(sql,/'processed_recipients',v_processed_count/);
 assert.match(sql,/'existing_marginal_notes',v_note_count/);
});
test('Ninguna sentencia, partida, nota o comunicación se cambia por solicitar revisión',()=>{
 assert.doesNotMatch(sql,/^\s*UPDATE\s+public\.(?:decretos|marriages|baptisms|marginal_notes|matrimonial_notifications)/im);
 assert.doesNotMatch(sql,/^\s*DELETE\s+FROM\s+public\./im);
 assert.match(sql,/'effects_modified',false/);
});
test('Evento de auditoría identifica actor y sentencia',()=>{
 assert.match(sql,/'nullity_judicial_review',v_case,'request_review'/);
 assert.match(sql,/'nullity_decree_id',v_decree\.id/);
});
test('RPC no ejecutable por anónimos ni PUBLIC',()=>{
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.request_nullity_judicial_review_v107/);
 assert.match(sql,/FROM PUBLIC,anon/);
 assert.match(sql,/TO authenticated/);
});
test('Archivo Cancillería ofrece filtro Tribunal',()=>{
 assert.match(ui,/updateType\('tribunal'\)/);
 assert.match(ui,/String\(value\)\.toLowerCase\(\) === 'tribunal'/);
});
test('Solo Tribunal activo sin solicitud previa puede abrir revisión',()=>{
 assert.match(ui,/type === 'tribunal' && \['active','vigente'\]/);
 assert.match(ui,/!nullityReviews\[row\.id\]/);
});
test('Interfaz solicita referencias, motivo detallado y confirma ausencia de efectos',()=>{
 assert.match(ui,/requestNullityReview\(row\)/);
 assert.match(ui,/p_authority_document_reference: supportingReference\.trim\(\)/);
 assert.match(ui,/p_review_reason: reason\.trim\(\)/);
 assert.match(ui,/La sentencia, el estado del Matrimonio, las notas marginales y los acuses permanecerán intactos/);
});
test('Archivo muestra revisión pendiente y no confunde sentencia con decreto sin efecto',()=>{
 assert.match(ui,/Revisión jurídica pendiente/);
 assert.match(ui,/type !== 'tribunal' && decreeEffect\(row\) === 'sin_modificacion'/);
});

const dioceseUi=fs.readFileSync(path.join(root,'src/pages/diocese/DiocesanDecreeOversightPage.jsx'),'utf8');
const parishUi=fs.readFileSync(path.join(root,'src/pages/parish/ParishSacramentalDecreeArchivePage.jsx'),'utf8');
const archiveModel=fs.readFileSync(path.join(root,'src/utils/decreeArchiveModel.mjs'),'utf8');

test('Diócesis obtiene casos de revisión y muestra el radicado sin permisos de escritura',()=>{
 assert.match(dioceseUi,/from\('nullity_judicial_review_cases'\)/);
 assert.match(dioceseUi,/Revisión jurídica pendiente/);
 assert.match(dioceseUi,/eq\('diocese_id',dioceseId\)/);
});
test('Parroquia propietaria consulta el estado de revisión sin editarlo',()=>{
 assert.match(parishUi,/from\('nullity_judicial_review_cases'\)/);
 assert.match(parishUi,/eq\('parish_id',user\.parishId\)/);
 assert.match(parishUi,/Revisión jurídica pendiente/);
});
test('Los tres roles ofrecen filtro específico Tribunal y nulidades',()=>{
 assert.match(ui,/updateType\('tribunal'\)/);
 assert.match(dioceseUi,/value="tribunal"/);
 assert.match(parishUi,/\['tribunal', 'Tribunal \/ nulidades'\]/);
 assert.match(archiveModel,/v\.includes\('nulidad'\) \|\| v === 'tribunal'/);
});
test('Supervisión diocesana y Parroquia no llaman sin efecto registral a una nulidad',()=>{
 assert.match(dioceseUi,/Sentencia de Tribunal · cotejar efectos registrales/);
 assert.match(dioceseUi,/decreeCategory\(r\.tipo,r\.payload\)!=='tribunal'/);
 assert.match(parishUi,/Sentencia de nulidad: verificar anotaciones y estado registral/);
});
