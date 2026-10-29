import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildHistoricalEvidenceDossierHtml } from '../src/utils/historicalEvidenceDossier.mjs';

const base = {
  link_id:'qa-link-v221', parish_id:'qa-parish-v221',
  source_key:'CONFIRMA-001', book_number:2, folio:5, entry_number:9,
  profile_key:'CONFIRMA',latest_decision:'investigate',
  evidence_reference:'Archivo histórico de prueba'
};
const build = (record=base,assessment={assessment:'strong_candidate'},dioceseName='Arquidiócesis Ficticia') =>
  buildHistoricalEvidenceDossierHtml({record,assessment,dioceseName,generatedAt:'2026-10-26T22:00:00.000Z'});

test('V221 generates standalone printable UTF-8 A4 workpaper from real shape',()=>{
 const html=build();
 assert.match(html,/^<!doctype html>/);
 for(const token of ['<meta charset="utf-8">','@page {size:A4','Ficha preliminar de cotejo histórico',
  'CONFIRMA-001','qa-parish-v221','qa-link-v221','2026-10-26T22:00:00.000Z'])
  assert.ok(html.includes(token),token);
});
test('V221 cannot generate an unattached case without parish or link ID',()=>{
 assert.throws(()=>build({...base,parish_id:''}),/jurisdicción verificable/);
 assert.throws(()=>build({...base,link_id:undefined}),/jurisdicción verificable/);
 assert.throws(()=>buildHistoricalEvidenceDossierHtml(),/jurisdicción verificable/);
});
test('V221 workpaper retains preliminary status when a historical source is verified',()=>{
 const html=build({...base,latest_decision:'source_verified'});
 assert.match(html,/DOCUMENTO PRELIMINAR DE COTEJO/);
 assert.match(html,/No es decreto, partida, constancia de sacramento/);
 assert.match(html,/No es decreto, partida, constancia de sacramento/);
 assert.match(html,/No se han escrito datos en el registro/);
 assert.match(html,/Ninguna coincidencia constituye validación archivística/);
});
for(const [code,expected] of [
 ['strong_candidate','Coincidencia técnica integral'],
 ['identity_conflict','Conflicto de identidad'],
 ['not_found','Sin partida física'],
 ['ambiguous','Múltiples coincidencias'],
 ['invalid','Evaluación técnica no disponible']
]){
 test('V221 dossier safely classifies '+code,()=>{
  assert.ok(build(base,{assessment:code}).includes(expected));
 });
}
test('V221 encodes untrusted RPC fields and never creates executable HTML',()=>{
 const payload='<script>alert("QA XSS")</script><img src=x onerror=alert(1)> & "quoted" \'single\'';
 const html=build({...base,source_key:payload,evidence_reference:payload,parish_id:payload}, {assessment:payload}, payload);
 assert.equal(html.includes('<script>'),false);
 assert.equal(html.includes('<img src=x'),false);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/&quot;quoted&quot;/);
 assert.match(html,/&#39;single&#39;/);
 assert.match(html,/&amp;/);
});
test('V221 technical candidate identifier is intentionally not disclosed',()=>{
 const html=build(base,{assessment:'strong_candidate',candidate_id:'QA-SENSITIVE-CANDIDATE-ID'});
 assert.doesNotMatch(html,/QA-SENSITIVE-CANDIDATE-ID/);
 assert.doesNotMatch(html,/<form|fetch\(|\.update\(|\.insert\(/);
});
test('V221 missing field values are explicit rather than falsely invented',()=>{
 const html=build({...base,source_key:null,book_number:null,folio:'',entry_number:undefined,evidence_reference:null});
 assert.match(html,/No registrado/);
 assert.match(html,/No registrado \/ No registrado \/ No registrado/);
});
test('V299 ficha imprimible sin sello de prueba y con datos de cotejo visibles',()=>{
 const html=build();
 assert.doesNotMatch(html,/body::before|body::after/);
 assert.doesNotMatch(html,/COPIA DE REVISIÓN|ENTORNO DE PRUEBAS|DOCUMENTO NO OFICIAL/);
 assert.match(html,/@page/);
 assert.match(html,/Ficha preliminar de cotejo histórico/);
});
test('V221 actual Chancery page adds click-triggered print and enforces session/case scope',()=>{
 const ui=fs.readFileSync('src/pages/chancery/HistoricalLinkReviewPage.jsx','utf8');
 assert.match(ui,/buildHistoricalEvidenceDossierHtml\(/);
 assert.match(ui,/Imprimir ficha de cotejo/);
 assert.match(ui,/!scopeCurrent \|\| loadedIdentity !== identity \|\| busy \|\| saving/);
 assert.match(ui,/visibleRows\.some\(row => row\.link_id === item\.link_id\)/);
 assert.match(ui,/popup\.opener = null/);
 assert.match(ui,/popup\.document\.write\(html\)/);
 assert.doesNotMatch(ui,/printEvidence\([\s\S]*?\) => \{[\s\S]*?\.from\(['"]legacy_record_links['"]\)/);
});
