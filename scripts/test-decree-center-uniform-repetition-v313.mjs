import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDocumentaryDecreeHtml} from '../src/services/decreeDocumentaryHtml.mjs';
const text=f=>fs.readFileSync(f,'utf8');
const header=text('src/components/chancery/DecreeCenterHeader.jsx');
const chancery=text('src/pages/chancery/SacramentalDecreesCenterPage.jsx');
const parish=text('src/pages/parish/ParishSacramentalDecreesCenterPage.jsx');
const repetition=text('src/pages/RepetitionDecreeWorkflowPage.jsx');
const form=text('src/components/chancery/RepetitionCanonicalIssueForm.jsx');
const sidebar=text('src/components/Sidebar.jsx');
const app=text('src/App.jsx');

test('V313 Centro de Decretos muestra Corrección Reposición Repetición y Archivo uniformemente',()=>{
 for (const mode of ['correction','reposition','repetition','archive']) {
   assert.match(header,new RegExp('\\b'+mode+': \\{'));
 }
 assert.match(header,/md:grid-cols-2 xl:grid-cols-4/);
 assert.match(header,/DECRE[E_]*_SACRAMENT_META/);
 for(const sacrament of ['bautismo','confirmacion','matrimonio','exequias'])
   assert.match(header,new RegExp('\\b'+sacrament+': \\{'));
 assert.match(chancery,/<DecreeCenterHeader showCenterButton=\{false\} selectionOnly/);
 assert.doesNotMatch(chancery,/<form\b|<article\b|<section\b/i);
 assert.doesNotMatch(sidebar,/label: 'Decretos de Repetición'/);
});
test('V313 todos los sacramentos conducen a Repetición con los permisos de rutas originales',()=>{
 assert.match(header,/if \(mode === 'repetition'\) return `\/parroquia\/decretos\?view=repeticion&sacrament=\$\{encodeURIComponent\(sacramentKey\)\}`/);
 assert.match(header,/if \(mode === 'repetition'\) \{[\s\S]*?\/chancery\/decretos\?view=repeticion&sacrament=/);
 assert.match(chancery,/view === 'repeticion'/);
 assert.match(parish,/params.get\('view'\) === 'repeticion'/);
 assert.match(app,/path="\/chancery\/decretos"[^\n]+requiredRole=\{ROLE_TYPES.CHANCERY\}/);
 assert.match(app,/path="\/parroquia\/decretos"[^\n]+requiredRole=\{ROLE_TYPES.PARISH\}/);
 assert.match(repetition,/selectedSacrament=SACRAMENTS\[params.get\('sacrament'\)\]/);
 assert.match(repetition,/mode="repetition" sacrament=\{selectedSacrament\} scope=\{scope\}/);
 assert.match(repetition,/rows.filter\(r=>r.sacrament_type===selectedSacrament/);
});
test('V313 Repetición comparte los componentes profesionales de Corrección y Reposición',()=>{
 const replacement=text('src/pages/chancery/decree-replacement/NewDecreeReplacementPage.jsx');
 const correction=text('src/pages/chancery/decree-correction/NewDecreeCorrectionPage.jsx');
 for(const component of ['CanonicalMasterPanel','CanonicalParishSelector','CanonicalDetailPanel',
  'CanonicalDetailHeader','CanonicalDecreeMetaGrid','CanonicalField','CanonicalNotice',
  'CanonicalDetailBody','CanonicalReasonPanel','CanonicalSectionTitle','CanonicalActionFooter']){
   assert.ok(form.includes('<'+component),component);
   assert.ok(replacement.includes('<'+component)||correction.includes('<'+component),
    'Estructura canónica no compartida '+component);
 }
 assert.match(repetition,/<RepetitionCanonicalIssueForm form=\{form\} setForm=\{setForm\}/);
 assert.doesNotMatch(repetition,/<header className="rounded-3xl bg-gradient-to-r/);
 assert.match(form,/grid gap-6 lg:grid-cols-\[0\.88fr_1\.35fr\]/);
});
test('V313 captura homogénea del expediente, sin campos de asiento supletorio',()=>{
 for(const field of ['Parroquia destinataria','Número de decreto','Fecha de emisión',
 'Concepto','Nombre completo del titular','Referencia documental',
 'Disposición de Cancillería','DA FE']) assert.ok(form.includes(field),field);
 assert.match(form,/<CanonicalReasonPanel value=\{form.reason\}/);
 assert.match(form,/Expedir repetición y notificar a la parroquia/);
 assert.match(form,/set\('target',event.target.value.toUpperCase\(\)\)/);
 assert.match(form,/set\('number',event.target.value.toUpperCase\(\)\)/);
 assert.doesNotMatch(form,/CanonicalSupplementaryPreview|originalRecordId|seat_decree|book_memory/);
 assert.match(form,/No cambia automáticamente datos sacramentales/);
 assert.match(repetition,/returnRepetitionToParish/);
 assert.match(repetition,/resolveParishRepetition/);
});
test('V313 Parroquia ve Repetición como operación, no una tarjeta duplicada',()=>{
 assert.match(parish,/Object.entries\(DECREE_OPERATION_META\)/);
 assert.match(parish,/key === 'repetition'/);
 assert.match(parish,/grid grid-cols-2 gap-2 xl:grid-cols-4/);
 assert.doesNotMatch(parish,/Decretos de Repetición recibidos/);
 assert.match(parish,/decreeRouteFor\(mode, sacramentKey, 'parish'\)/);
});
test('V313 documento titula Repetición por cada sacramento sin confundir Reposición',()=>{
 const sacraments={bautismo:'BAUTISMO',confirmacion:'CONFIRMACIÓN',
  matrimonio:'MATRIMONIO',exequias:'EXEQUIAS'};
 for(const [sacrament,label] of Object.entries(sacraments)){
  const html=buildDocumentaryDecreeHtml({row:{tipo:'repeticion',sacrament_type:sacrament,
   decree_number:'QA-REPETICION',payload:{decreeType:'repeticion'}},institution:{},parish:{}});
  assert.ok(html.includes('DECRETO DE REPETICIÓN DE '+label),label);
  assert.ok(!html.includes('DECRETO DE REPOSICIÓN'));
 }
});
