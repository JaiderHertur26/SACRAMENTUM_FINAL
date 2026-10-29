import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SACRAMENTS,validateRepetitionDraft,isRepetitionDecree,canParishResolveRepetition,canChanceryReturnRepetition,repetitionStatusLabel} from '../src/utils/repetitionDecreePolicy.mjs';
import {decreeCategory,decreeEffect,decreeCanReverse,decreeTypeLabel} from '../src/utils/decreeArchiveModel.mjs';
import {buildDocumentaryDecreeHtml} from '../src/services/decreeDocumentaryHtml.mjs';

const src=path=>fs.readFileSync(path,'utf8');
const sql=src('supabase/deployment/v312_decree_repetition_workflow.sql');
const ui=src('src/pages/RepetitionDecreeWorkflowPage.jsx');
const svc=src('src/services/repetitionDecreeV312.js');
const app=src('src/App.jsx');
const side=src('src/components/Sidebar.jsx');
const status='awaiting_parish';
const row=(current=status)=>({
 id:'uuid',tipo:'repeticion',status:'active',decree_number:'REP-2026-001',
 decree_date:'2026-10-29',sacrament_type:'bautismo',
 payload:{decreeType:'repeticion',recordOrigin:'chancery_repetition_v312',
  repetitionWorkflowStatus:current,targetName:'TITULAR TEST',reason:'Fundamento documental',
  evidenceRef:'Libro histórico 15 folio 4',instruction:'Verificar el antecedente y registrar la constancia',
  signerName:'Canciller de prueba',signerTitle:'CANCILLER'}
});
test('V312 repetición no es corrección ni reposición y no toca libros',()=>{
 assert.equal(decreeCategory('repeticion'),'repeticion');
 assert.equal(decreeCategory('porRepeticion'),'repeticion');
 assert.equal(decreeCategory('reposicion'),'reposicion');
 assert.equal(decreeCategory('porReposicion'),'reposicion');
 assert.equal(decreeCategory('correccion'),'correccion');
 assert.equal(decreeEffect(row()),'sin_modificacion');
 assert.equal(decreeCanReverse(row()),false);
 assert.match(decreeTypeLabel(row()),/Repetición/);
 assert.equal(isRepetitionDecree(row()),true);
});
test('V312 estados con transiciones seguras y control de duplicación',()=>{
 assert.equal(canParishResolveRepetition(row('awaiting_parish')),true);
 assert.equal(canParishResolveRepetition(row('completed_documentary')),false);
 assert.equal(canParishResolveRepetition(row('needs_chancery_review')),false);
 assert.equal(canChanceryReturnRepetition(row('needs_chancery_review')),true);
 assert.equal(canChanceryReturnRepetition(row('completed_documentary')),false);
 assert.equal(canChanceryReturnRepetition(row('awaiting_parish')),false);
 assert.match(repetitionStatusLabel('completed_documentary'),/completo/i);
 assert.equal(Object.keys(SACRAMENTS).length,4);
});
test('V312 datos de expedición obligatorios y firmante institucional',()=>{
 const base={parishId:'pid',sacrament:'bautismo',conceptId:'cid',number:'REP-001',
 date:'2026-10-29',target:'Titular prueba',reason:'Fundamento documental institucional',
 evidence:'Libro, folio, numero',instruction:'Verificar constancia parroquial',
 signer:'canciller'};
 assert.equal(validateRepetitionDraft(base,'2026-10-29'),true);
 for(const broken of [{signer:''},{sacrament:'general'},{sacrament:'reposicion'},
 {date:'2030-01-01'},{evidence:'corta'},{instruction:'corta'},{reason:'corta'},
 {number:'1'}, {target:'A'}]){
 assert.throws(()=>validateRepetitionDraft({...base,...broken},'2026-10-29'));
 }
});
test('V312 emisión separada con rol, jurisdicción y concepto histórico exacto',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.issue_repetition_decree_v312/);
 assert.match(sql,/role='chancery' AND is_active IS TRUE/);
 assert.match(sql,/c.id=ch AND c.diocese_id=di/);
 assert.match(sql,/p.diocese_id=di AND p.is_operational IS TRUE/);
 assert.match(sql,/lower\(concept.tipo\)<>'porrepeticion'/);
 assert.match(sql,/concept.seinscribe IS DISTINCT FROM false/);
 assert.match(sql,/concept.gennota IS DISTINCT FROM false/);
 assert.match(sql,/concept.enlibro<>0/);
 assert.match(sql,/p_signer NOT IN \('canciller','vicecanciller'\)/);
 assert.match(sql,/hashtextextended\(di::text\|\|':'\|\|lower\(n\),312\)/);
 assert.match(sql,/WHERE diocese_id=di AND lower\(btrim\(decree_number\)\)=lower\(n\)/);
 assert.match(sql,/VALUES\(p_parish_id,di,ch,'repeticion'/);
 assert.match(sql,/'registersEffect',false/);
 assert.match(sql,/'generatesMarginalNote',false/);
 assert.match(sql,/'affectsSacramentalRecord',false/);
 assert.match(sql,/INSERT INTO public\.registry_audit_log/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.issue_repetition_decree_v312/);
 assert.doesNotMatch(sql,/DELETE FROM public\.(baptisms|confirmations|marriages|funerals)/i);
 assert.doesNotMatch(sql,/UPDATE public\.(baptisms|confirmations|marriages|funerals|pending_baptisms)/i);
});
test('V312 parroquia solo destino, constancia o aclaración auditadas',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.resolve_parish_repetition_v312/);
 assert.match(sql,/role='parish' AND is_active IS TRUE/);
 assert.match(sql,/WHERE id=p_decree_id AND parish_id=parish AND diocese_id=di/);
 assert.match(sql,/row\.payload->>'repetitionWorkflowStatus',''\)<>'awaiting_parish'/);
 assert.match(sql,/p_resolution NOT IN \('documented','needs_review'\)/);
 assert.match(sql,/'completed_documentary' ELSE 'needs_chancery_review'/);
 assert.match(sql,/UPDATE public\.official_notifications SET status=/);
 assert.match(sql,/'resolve_parish_repetition_v312'/);
 assert.match(sql,/noSacramentalMutation',true/);
 assert.match(sql,/RETURN jsonb_build_object\('decreeId',p_decree_id,'status',new_status\)/);
});
test('V312 Cancillería solo reabre observados, nunca completados',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.return_repetition_to_parish_v312/);
 assert.match(sql,/row\.payload->>'repetitionWorkflowStatus'<>'needs_chancery_review'/);
 assert.match(sql,/diocese_id=di AND chancery_id=ch/);
 assert.match(sql,/UPDATE public\.official_notifications SET status='pending'/);
 assert.match(sql,/'return_repetition_to_parish_v312'/);
});
test('V312 notificación de decretos privada: obispo/administrador fuera',()=>{
 assert.match(sql,/CREATE POLICY decree_notification_private_v312 ON public\.official_notifications/);
 assert.match(sql,/AS RESTRICTIVE FOR SELECT TO authenticated/);
 assert.match(sql,/category <> 'decree'/);
 assert.match(sql,/public\.current_app_role\(\)='chancery'/);
 assert.match(sql,/public\.current_app_role\(\)='parish'/);
 assert.match(sql,/receiver_parish_id=public\.current_app_parish_id\(\)/);
 assert.doesNotMatch(sql,/current_app_role\(\)='diocese'/);
});
test('V312 documento imprimible identifica Repetición, evidencia, disposición y firmante',()=>{
 const html=buildDocumentaryDecreeHtml({row:row(),institution:{dioceseName:'Arquidiócesis de prueba'},
 parish:{name:'Parroquia prueba'}});
 for(const s of ['DECRETO DE REPETICIÓN','REFERENCIA DOCUMENTAL',
 'DISPOSICIÓN DE CANCILLERÍA','Canciller de prueba','TITULAR TEST','NO SE CREA']){
  assert.ok(html.includes(s),s);
 }
 assert.equal(html.includes('DECRETO DE REPOSICIÓN'),false);
 const escaped=buildDocumentaryDecreeHtml({row:{
 ...row(),payload:{...row().payload,reason:'<script>alert(1)</script>'}
 }});
 assert.ok(!escaped.includes('<script>alert(1)</script>'));
});
test('V312 rutas, botones, campos y recibo del archivo en ambos roles',()=>{
 assert.match(app,/path="\/chancery\/decretos\/repeticion"[^]*?requiredRole=\{ROLE_TYPES\.CHANCERY\}/);
 assert.match(app,/path="\/parroquia\/decretos\/repeticion"[^]*?requiredRole=\{ROLE_TYPES\.PARISH\}/);
 assert.match(side,/Decretos de Repetición/);
 assert.match(ui,/Expedir nuevo Decreto de Repetición/);
 assert.match(ui,/Concepto histórico de Repetición/);
 assert.match(ui,/Autoridad que expide/);
 assert.match(ui,/Ver \/ Imprimir/);
 assert.match(ui,/Registrar actuación parroquial/);
 assert.match(ui,/Solicitar aclaración a Cancillería/);
 assert.match(ui,/Responder aclaración y reenviar al párroco/);
 assert.match(ui,/Expediente completo/);
 assert.match(ui,/const current=rows\.find\(r=>r\.id===focused\?\.id\)\|\|null/);
 assert.match(svc,/\.eq\('tipo','repeticion'\)/);
 assert.match(svc,/\.eq\('parish_id',parishId\)/);
 assert.match(svc,/rpc\('issue_repetition_decree_v312'/);
 assert.match(svc,/rpc\('resolve_parish_repetition_v312'/);
 assert.match(svc,/rpc\('return_repetition_to_parish_v312'/);
});
