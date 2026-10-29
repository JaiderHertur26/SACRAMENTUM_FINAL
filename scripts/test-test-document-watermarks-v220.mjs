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
 ['expediente matrimonial',()=>buildMarriageDossierHtml({meta:{dossierNumber:'QA-V220-4'}})]
];
const prohibited=/COPIA DE REVISIÓN|ENTORNO DE PRUEBAS|DOCUMENTO NO OFICIAL|NO APTO PARA EXPEDICIÓN/;
const docText = doc => doc.internal.pages.slice(1).map(page=>page.join('\n'));

test('V299 mantiene reconocido el modo de datos aunque no añade rótulos',()=>{
 assert.equal(isTestRegistryData(),true);
 assert.equal(testDocumentPrintCss(),'');
 const source=fs.readFileSync('src/utils/testDocumentStamp.mjs','utf8');
 assert.match(source,/VITE_REGISTRY_DATA_MODE !== 'official'/);
 assert.match(source,/isKnownTestRegistryProject/);
});

test('V299 la impresión PDF conserva todas las páginas sin inscribir leyendas',()=>{
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 doc.text('EJEMPLO INTERNO',20,20);doc.addPage();doc.text('SEGUNDA PAGINA',20,20);
 doc.setPage(1);
 assert.strictEqual(stampTestPdfPages(doc),doc);
 assert.equal(doc.getNumberOfPages(),2);
 assert.equal(doc.getCurrentPageInfo().pageNumber,1);
 assert.ok(doc.output('arraybuffer').byteLength>1000);
 for(const content of docText(doc))assert.doesNotMatch(content,prohibited);
});
for(const [title,builder] of documentBuilders){
 test('V299 HTML imprimible limpio: '+title,()=>{
  const html=builder();
  assert.match(html,/^<!doctype html>/i);
  assert.doesNotMatch(html,prohibited);
  assert.doesNotMatch(html,/body::after/);
 });
}
for(const [label,builder] of [
 ['libro de bautismo',()=>buildSacramentalBookPdf({records:[],sacrament:'bautismo',parishName:'QA PARROQUIA',dioceseName:'QA DIOCESIS'})],
 ['índice alfabético',()=>buildSacramentalIndexPdf({records:[],sacrament:'bautismo',parishName:'QA PARROQUIA',dioceseName:'QA DIOCESIS'})],
 ['informe diocesano',()=>buildDiocesanSacramentalPdf({report:{report_number:'QA-V220',diocese:{name:'QA FICTICIA'},annual_counts:[],age_distribution:[],totals:{bautismo:0,confirmacion:0,matrimonio:0,exequias:0,total:0}}})],
 ['informe de curia',()=>buildDiocesanSacramentalPdf({report:{report_number:'QA-V220-CURIA',diocese:{name:'QA FICTICIA'},curia_breakdown:{},pastoral_supplement:{},annual_counts:[],age_distribution:[],totals:{bautismo:0,confirmacion:0,matrimonio:0,exequias:0,total:0}}})]
]){
 test('V299 PDF sin rótulos superpuestos: '+label,()=>{
  const pdf=builder();
  assert.ok(pdf.output('arraybuffer').byteLength>1000);
  assert.ok(docText(pdf).length>0);
  for(const content of docText(pdf))assert.doesNotMatch(content,prohibited);
 });
}
test('V299 impresión de aplicación conserva modo interno y carece de estampas',()=>{
 const css=fs.readFileSync('src/index.css','utf8');
 const entry=fs.readFileSync('src/main.jsx','utf8');
 assert.doesNotMatch(css,prohibited);
 assert.match(entry,/document.documentElement.dataset.registryDataMode/);
 assert.match(entry,/isTestRegistryData\(\)/);
});
test('V299 librería de documentos sigue utilizando la misma plantilla compartida',()=>{
 const src=fs.readFileSync('src/pages/DocumentTemplateLibraryPage.jsx','utf8');
 assert.match(src,/testDocumentPrintCss/);
 assert.match(src,/win\.document\.write/);
});
