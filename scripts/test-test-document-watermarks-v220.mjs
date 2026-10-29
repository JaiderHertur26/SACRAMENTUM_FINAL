import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { jsPDF } from 'jspdf';
import { isTestRegistryData, testDocumentPrintCss, stampTestPdfPages } from '../src/utils/testDocumentStamp.mjs';
import { buildDocumentaryDecreeHtml } from '../src/services/decreeDocumentaryHtml.mjs';
import { buildDecreeDocumentHtml } from '../src/services/decreeDocumentHtml.js';
import { buildFuneralPartidaHtml, buildFuneralConstanciaHtml } from '../src/utils/funeralDocumentHtml.js';
import { buildMarriageDossierHtml } from '../src/utils/marriageDossierDocumentHtml.js';
import { buildSacramentalBookPdf, buildSacramentalIndexPdf } from '../src/services/sacramentalBookPdf.js';
import { buildDiocesanSacramentalPdf } from '../src/services/diocesanReportPdf.js';

const fixture={nombres:'QA',apellidos:'FICTICIO',book_number:'1',folio:'1',number:'1',celebration_date:'2026-10-26',raw_data:{}};
const documentBuilders=[
 ['decreto documental',()=>buildDocumentaryDecreeHtml({row:{decree_number:'QA-V220-1',tipo:'documental'}})],
 ['decreto de corrección',()=>buildDecreeDocumentHtml({row:{decree_number:'QA-V220-2',tipo:'correccion'}})],
 ['decreto de reposición',()=>buildDecreeDocumentHtml({row:{decree_number:'QA-V220-3',tipo:'reposicion'}})],
 ['partida de exequias',()=>buildFuneralPartidaHtml({record:fixture})],
 ['constancia de exequias',()=>buildFuneralConstanciaHtml({record:fixture})],
 ['expediente matrimonial 4 hojas',()=>buildMarriageDossierHtml({meta:{dossierNumber:'QA-V220-4'}})]
];
const docText = doc => doc.internal.pages.slice(1).map(page=>page.join('\n'));
test('V250 preserves draft provenance without the former banner text',()=>{
 assert.equal(isTestRegistryData(),true);
 assert.match(testDocumentPrintCss(),/COPIA DE REVISIÓN/);
 assert.match(testDocumentPrintCss(),/COPIA DE REVISIÓN/);
 assert.match(testDocumentPrintCss(),/body::after/);
});
test('V220 PDF stamps EVERY page and retains previous selected page',()=>{
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 doc.text('DATOS DE QA FICTICIOS',20,20);
 doc.addPage();doc.text('SEGUNDA PAGINA QA',20,20);
 doc.setPage(1);
 stampTestPdfPages(doc);
 assert.equal(doc.getNumberOfPages(),2);
 assert.equal(doc.getCurrentPageInfo().pageNumber,1);
 assert.ok(doc.output('arraybuffer').byteLength>1000);
 const pages=docText(doc);
 for(const [i,p] of pages.entries()){
  assert.match(p,/COPIA DE REVISIÓN/, 'page '+(i+1));
  assert.match(p,/NO APTO PARA EXPEDICIÓN/, 'page '+(i+1));
 }
});
for(const [title,builder] of documentBuilders){
 test('V220 independent printable HTML marks '+title,()=>{
  const html=builder();
  assert.ok(html.startsWith('<!doctype html>')||html.startsWith('<!DOCTYPE html>'));
  if(title==='decreto de corrección'||title==='decreto de reposición'){
    assert.doesNotMatch(html,/COPIA DE REVISIÓN/);
    assert.match(html,/ENTORNO DE PRUEBAS/);
    assert.match(html,/size:Letter/);
  }else{
    assert.match(html,/COPIA DE REVISIÓN/);
    assert.match(html,/COPIA DE REVISIÓN/);
    assert.match(html,/body::after/);
  }
 });
}
for(const [label,builder] of [
 ['libro de bautismo',()=>buildSacramentalBookPdf({records:[],sacrament:'bautismo',parishName:'QA PARROQUIA',dioceseName:'QA DIOCESIS'})],
 ['índice alfabético',()=>buildSacramentalIndexPdf({records:[],sacrament:'bautismo',parishName:'QA PARROQUIA',dioceseName:'QA DIOCESIS'})],
 ['informe estadístico diocesano',()=>buildDiocesanSacramentalPdf({report:{report_number:'QA-V220',diocese:{name:'QA FICTICIA'},annual_counts:[],age_distribution:[],totals:{bautismo:0,confirmacion:0,matrimonio:0,exequias:0,total:0}}})],
 ['informe de Curia / parroquia',()=>buildDiocesanSacramentalPdf({report:{report_number:'QA-V220-CURIA',diocese:{name:'QA FICTICIA'},curia_breakdown:{},pastoral_supplement:{},annual_counts:[],age_distribution:[],totals:{bautismo:0,confirmacion:0,matrimonio:0,exequias:0,total:0}}})]
]){
 test('V220 generated jsPDF stamps '+label,()=>{
   const pdf=builder();
   const pages=docText(pdf);
   assert.ok(pages.length>0);
   assert.ok(pdf.output('arraybuffer').byteLength>1000);
   for(const [i,content] of pages.entries()){
      assert.match(content,/COPIA DE REVISIÓN/,label+' page '+i);
   }
 });
}
test('V220 ordinary SPA printing always stamps the test-mode HTML root',()=>{
 const css=fs.readFileSync('src/index.css','utf8');
 const entry=fs.readFileSync('src/main.jsx','utf8');
 assert.match(css,/html\[data-registry-data-mode="test"\] body::after/);
 assert.match(css,/COPIA DE REVISIÓN/);
 assert.match(entry,/document.documentElement.dataset.registryDataMode/);
 assert.match(entry,/isTestRegistryData\(\)/);
});
test('V220 future official mode is explicit and never silently inferred from old QA data',()=>{
 const source=fs.readFileSync('src/utils/testDocumentStamp.mjs','utf8');
 assert.match(source,/VITE_REGISTRY_DATA_MODE !== 'official'/);
 assert.doesNotMatch(source,/window\.location|document\.cookie|localStorage/);
});
test('V250 independent document-template popup uses the same draft watermark',()=>{
 const source=fs.readFileSync('src/pages/DocumentTemplateLibraryPage.jsx','utf8');
 assert.match(source,/testDocumentPrintCss/);
 assert.match(source,/win\.document\.write/);
 assert.match(source,/\$\{testDocumentPrintCss\(\)\}/);
});
