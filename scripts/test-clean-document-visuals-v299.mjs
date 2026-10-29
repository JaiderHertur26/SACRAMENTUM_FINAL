import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isTestRegistryData, testDocumentPrintCss, stampTestPdfPages } from '../src/utils/testDocumentStamp.mjs';
import { isKnownTestRegistryProject } from '../src/utils/registryDataMode.mjs';
import { buildDecreeDocumentHtml } from '../src/services/decreeDocumentHtml.js';
import { jsPDF } from 'jspdf';

const prohibited = /ENTORNO DE PRUEBAS|DOCUMENTO NO OFICIAL|COPIA DE REVISIÓN|NO APTO PARA EXPEDICIÓN/i;
const extensions=new Set(['.js','.jsx','.mjs','.ts','.tsx','.css','.html']);
function scan(dir){
 const hits=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())hits.push(...scan(file));
  else if(extensions.has(path.extname(file)) && prohibited.test(fs.readFileSync(file,'utf8')))hits.push(file);
 }
 return hits;
}

test('V299 el código activo carece de las leyendas visibles en todas las plantillas',()=>{
 assert.deepEqual(scan('src'),[]);
});
test('V299 documento de Cancillería conserva todos los elementos, sin leyendas',()=>{
 const html=buildDecreeDocumentHtml({
  row:{tipo:'correccion',sacrament_type:'bautismo',decree_number:'DECRETO 002',decree_date:'2026-10-27',
   diocese_id:'452d50bc-ff3e-448e-9b93-1e97f8d321e2',
   payload:{newPartidaDraft:{nombres:'THIAGO JOSÉ',apellidos:'SIERRA REYES',fechaSacramento:'2024-12-13'},issuingSigner:{name:'PBRO. JULIÁN MOGOLLÓN',office:'vice_canciller'}}},
  institution:{dioceseName:'Arquidiócesis de Barranquilla'},autoPrint:false
 });
 assert.match(html,/EL TRECE DE DICIEMBRE DE DOS MIL VEINTICUATRO/);
 assert.match(html,/class="archdiocese-crest"/);
 assert.match(html,/class="signature-row"/);
 assert.match(html,/OFICINA DE DOCUMENTOS DE CANCILLERÍA/);
 assert.doesNotMatch(html,prohibited);
});
test('V299 no transforma el proyecto de ensayos en base oficial ni cambia seguridad',()=>{
 assert.equal(isTestRegistryData(),true);
 assert.equal(isKnownTestRegistryProject('https://foczofcmwampjvlfbsqn.supabase.co'),true);
 const guard=fs.readFileSync('guard-official-build-v223.mjs','utf8');
 assert.match(guard,/assessOfficialBuild/);
 assert.equal(testDocumentPrintCss(),'');
 const pdf=new jsPDF();
 assert.strictEqual(stampTestPdfPages(pdf),pdf);
 assert.doesNotMatch(pdf.internal.pages.slice(1).join('\\n'),prohibited);
});
