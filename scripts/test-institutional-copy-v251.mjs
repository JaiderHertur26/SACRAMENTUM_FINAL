import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {jsPDF} from 'jspdf';
import {isTestRegistryData,testDocumentPrintCss,stampTestPdfPages} from '../src/utils/testDocumentStamp.mjs';
import {isKnownTestRegistryProject} from '../src/utils/registryDataMode.mjs';

const root=path.resolve('src');
const extensions=new Set(['.jsx','.tsx','.js','.ts','.mjs','.css']);
const all=[];
function walk(dir){
 for(const f of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,f.name);
  if(f.isDirectory())walk(p);
  else if(extensions.has(path.extname(p)))all.push({p:path.relative(root,p),text:fs.readFileSync(p,'utf8')});
 }
}
walk(root);
const source=name=>fs.readFileSync(name,'utf8');
test('V251 removes the requested draft wording throughout active application source',()=>{
 for(const f of all)assert.doesNotMatch(f.text,/\bborradores?\b/i,f.p);
});
test('V251 workflows still distinguish reserved preregistration from seated sacraments',()=>{
 const bapt=source('src/pages/parish/BaptismNewPage.jsx');
 const conf=source('src/pages/parish/ConfirmationNewPage.jsx');
 const parish=source('src/pages/parish/ParishDashboard.jsx');
 for(const content of [bapt,conf]){
  assert.match(content,/Pre-registro creado|Pre-registro Creado/);
  assert.match(content,/Guardar pre-registro/);
 }
 assert.match(parish,/Asentar registros pendientes/);
 const dossier=source('src/pages/parish/MarriageDossierPage.jsx');
 assert.match(dossier,/<option value="draft">Pre-registro<\/option>/);
 assert.match(dossier,/<option value="ready">Completo \/ listo<\/option>/);
});
test('V251 print and PDF keep non-certifying provenance in known QA project, without requested word',()=>{
 assert.equal(isTestRegistryData(),true);
 assert.equal(isKnownTestRegistryProject('https://foczofcmwampjvlfbsqn.supabase.co'),true);
 const css=testDocumentPrintCss();
 assert.match(css,/COPIA DE REVISIÓN/);
 assert.doesNotMatch(css,/\bborrador\b/i);
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 stampTestPdfPages(pdf);
 const content=pdf.internal.pages.slice(1).join('\n');
 assert.match(content,/COPIA DE REVISIÓN/);
 assert.match(content,/NO APTO PARA EXPEDICIÓN/);
 assert.doesNotMatch(content,/\bborrador\b/i);
 const spa=source('src/index.css');
 assert.match(spa,/COPIA DE REVISIÓN/);
 assert.doesNotMatch(spa,/\bborrador\b/i);
});
test('V251 does not modify recognized QA reference, release guard or operational statuses',()=>{
 const core=source('release-guard-core-v223.mjs');
 assert.match(core,/KNOWN_QA_PROJECT_REFS/);
 const registry=source('src/utils/registryDataMode.mjs');
 assert.match(registry,/foczofcmwampjvlfbsqn/);
 const services=source('src/services/sacramentsService.js');
 assert.match(services,/create_pending_baptism/);
 assert.match(services,/create_pending_confirmation/);
});
test('V251 prevention is registered in local and CI test gates',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(source(f),/scripts\/test-institutional-copy-v251\.mjs/);
});
