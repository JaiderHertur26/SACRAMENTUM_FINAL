import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateAffectedEntries,involvedParishIds,repetitionCaseStatus} from '../src/utils/repetitionCaseV314.mjs';
import {validateRepetitionDraft} from '../src/utils/repetitionDecreePolicy.mjs';
import {buildDocumentaryDecreeHtml} from '../src/services/decreeDocumentaryHtml.mjs';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const entry=(parishId,folio,disposition='investigate')=>({
 parishId,parishName:parishId===a?'Parroquia Norte':'Parroquia Sur',
 book:'5',folio,number:'12',justification:'Investigación de duplicidad con testigos y libros',
 disposition
});
const entries=[entry(a,'10','retain'),entry(b,'11','without_effect')];
const row=actions=>({tipo:'repeticion',sacrament_type:'bautismo',decree_number:'R-314-1',
 payload:{repetitionCaseMode:'duplicate_baptism_entries_v314',affectedEntries:entries,
 repetitionParishActions:actions,reason:'Dos partidas vinculadas',targetName:'BAUTIZADO TEST',
 evidenceRef:'Libros 5',instruction:'Verificar ambas actas',signerName:'Canciller',signerTitle:'CANCILLER'}});
const src=p=>fs.readFileSync(p,'utf8');
const sql=src('supabase/deployment/v314_repetition_multiple_baptism_entries.sql');

test('V314 dos partidas en parroquias diferentes y en la misma parroquia',()=>{
 assert.equal(validateAffectedEntries(entries,a),true);
 assert.deepEqual(involvedParishIds(entries),[a,b]);
 assert.equal(validateAffectedEntries([entry(a,'10'),entry(a,'11')],a),true);
 assert.deepEqual(involvedParishIds([entry(a,'10'),entry(a,'11')]),[a]);
 assert.throws(()=>validateAffectedEntries([entry(a,'10')],a));
 assert.throws(()=>validateAffectedEntries([entry(a,'10'),entry(a,'10')],a));
 assert.throws(()=>validateAffectedEntries(entries,'otra'));
 assert.throws(()=>validateAffectedEntries([entry(a,'10','invalid'),entry(b,'11')],a));
});

test('V314 protege parroquias fuera del sistema y exige constancia verificable',()=>{
 const outside={...entry('', '90','investigate'),external:true,
  parishName:'Parroquia no digitalizada',externalJurisdiction:'Otra diócesis'};
 const grouped=[entry(a,'10'),outside];
 assert.equal(validateAffectedEntries(grouped,a),true);
 assert.deepEqual(involvedParishIds(grouped),[a]);
 const item={payload:{affectedEntries:grouped.map((v,i)=>({...v,externalKey:v.external?'external-'+(i+1):null})),
  repetitionParishActions:{[a]:{outcome:'documented'}},repetitionExternalActions:{}}};
 assert.equal(repetitionCaseStatus(item),'awaiting_parishes');
 item.payload.repetitionExternalActions['external-2']={evidenceRef:'Constancia firmada 2026'};
 assert.equal(repetitionCaseStatus(item),'completed_documentary');
 item.payload.repetitionParishActions[a]={outcome:'needs_review'};
 assert.equal(repetitionCaseStatus(item),'needs_chancery_review');
 assert.match(sql,/register_external_repetition_constancy_v314/);
 assert.match(sql,/externalJurisdiction/);
 assert.match(sql,/externalKey/);
});

test('V314 evita cerrar expediente hasta obtener todas las constancias',()=>{
 assert.equal(repetitionCaseStatus(row({})),'awaiting_parishes');
 assert.equal(repetitionCaseStatus(row({[a]:{outcome:'documented'}})),'awaiting_parishes');
 assert.equal(repetitionCaseStatus(row({[a]:{outcome:'documented'},[b]:{outcome:'needs_review'}})),'needs_chancery_review');
 assert.equal(repetitionCaseStatus(row({[a]:{outcome:'documented'},[b]:{outcome:'documented'}})),'completed_documentary');
});

test('V314 exige fundamento y conserva validación documental histórica V312',()=>{
 const base={parishId:a,sacrament:'bautismo',conceptId:'cid',number:'REP-001',
  date:'2026-10-29',target:'Titular prueba',reason:'Expediente con dos partidas del bautizado',
  evidence:'Actas 5/10 y 5/11',instruction:'Examinar y reportar ambas partidas',
  signer:'canciller',caseMode:'duplicate_baptism_entries',affectedEntries:entries};
 assert.equal(validateRepetitionDraft(base,'2026-10-29'),true);
 assert.throws(()=>validateRepetitionDraft({...base,sacrament:'confirmacion'},'2026-10-29'));
 assert.throws(()=>validateRepetitionDraft({...base,affectedEntries:[entry(a,'10')]},'2026-10-29'));
 assert.equal(validateRepetitionDraft({...base,caseMode:'documentary',affectedEntries:[]},'2026-10-29'),true);
});

test('V314 documento contiene las dos referencias y escapa datos',()=>{
 const html=buildDocumentaryDecreeHtml({row:row({}),institution:{dioceseName:'Barranquilla'}});
 for(const phrase of ['PARTIDAS INVOLUCRADAS','Parroquia Norte','Parroquia Sur','Folio 10','Folio 11','sin efectos registrales'])
  assert.ok(html.includes(phrase),phrase);
 const bad=row({});
 bad.payload.affectedEntries=[entry(a,'<img src=x onerror=alert(1)>'),entry(b,'11')];
 const escaped=buildDocumentaryDecreeHtml({row:bad});
 assert.ok(!escaped.includes('<img src=x onerror=alert(1)>'));
});

test('V314 SQL delimita jurisdicción, verificación de partidas y RLS sin borrar registros',()=>{
 for(const phrase of [
  'issue_repetition_case_v314','list_repetition_cases_v314','resolve_repetition_parish_v314',
  'return_repetition_parish_v314','p_sacrament',"p_sacrament<>'bautismo'",
  'b.parish_id=pid','b.book_number','b.folio','b.number','p_parish_id',
  'diocese_id=di','role_name',"role_name='chancery'","role_name='parish'",
  'FOR UPDATE','awaiting_parishes','needs_chancery_review','completed_documentary',
  'noSacramentalMutation','RETURN QUERY SELECT d.*'
 ])assert.ok(sql.includes(phrase),phrase);
 assert.doesNotMatch(sql,/DELETE FROM public\.(baptisms|decretos)/i);
 assert.doesNotMatch(sql,/UPDATE public\.baptisms/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.list_repetition_cases_v314/);
});
