import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 decreeCategory,decreeSacrament,decreeEffect,decreeCanReverse,isHistoricalDecree
} from '../src/utils/decreeArchiveModel.mjs';

const scriptures=['bautismo','confirmacion','matrimonio','exequias'];
const types=['correccion','reposicion','documental'];
const qaParishes=['QA-PARROQUIA-A','QA-PARROQUIA-B'];
const origins=['new','legacy'];
const decreeKinds=scriptures.flatMap(s=>types.map(kind=>({s,kind})));
decreeKinds.push({s:'matrimonio',kind:'nulidad_matrimonial'});

const fixture=(s,kind,origin,parish)=>({
 id:['NO-REAL',s,kind,origin,parish].join('::'),
 tipo:kind,sacrament_type:s,parish_id:parish,diocese_id:'QA-DIOCESIS',
 status:'active',
 payload:{
  qaOnly:true,source:origin==='legacy'?'ANULACION.DBF':'sacramentum_internal',
  legacyHistorical:origin==='legacy',
  recordOrigin:origin==='legacy'?'legacy_import':'current',
  sourceReference:origin==='legacy'?'QA: archivo antiguo ficticio':null,
  originalLocation:{book:1,folio:11,number:9},
  replacementLocation:{book:2,folio:4,number:18},
  registersEffect:kind==='documental'?false:true,
  executionReconciled:false
 }
});
const fixtures=decreeKinds.flatMap(({s,kind})=>origins.flatMap(origin=>qaParishes.map(parish=>fixture(s,kind,origin,parish))));

test('Matriz de decretos ficticios cubre cuatro sacramentos, origen nuevo/antiguo y dos parroquias',()=>{
 assert.equal(fixtures.length,52);
 assert.equal(new Set(fixtures.map(x=>x.id)).size,fixtures.length);
 assert.equal(fixtures.filter(x=>x.tipo==='nulidad_matrimonial').every(x=>x.sacrament_type==='matrimonio'),true);
 assert.equal(fixtures.every(x=>x.payload.qaOnly),true);
});
for(const row of fixtures){
 test('Caso ficticio de archivo y efectos: '+row.id,()=>{
  const isLegacy=row.payload.legacyHistorical;
  assert.equal(decreeSacrament(row.sacrament_type),row.sacrament_type);
  assert.equal(isHistoricalDecree(row),isLegacy);
  const effect=decreeEffect(row);
  if(['documental','nulidad_matrimonial'].includes(row.tipo)) assert.equal(effect,'sin_modificacion');
  else if(isLegacy) assert.equal(effect,'historico_no_verificado');
  else assert.equal(effect,'registral');
  assert.equal(decreeCanReverse(row),!isLegacy&&['correccion','reposicion'].includes(row.tipo));
  // Un decreto canónico, dos consultas al MISMO ID; no crear duplicado por rol.
  const chanceryView=fixtures.find(x=>x.id===row.id && x.diocese_id==='QA-DIOCESIS');
  const parishView=fixtures.find(x=>x.id===row.id && x.parish_id===row.parish_id);
  assert.strictEqual(chanceryView,parishView);
  assert.equal(fixtures.filter(x=>x.id===row.id && x.parish_id!==row.parish_id).length,0);
  if(isLegacy)assert.ok(row.payload.sourceReference);
 });
}
test('El archivo de Cancillería y Parroquia consulta una misma tabla canónica',()=>{
 const code=fs.readFileSync('src/services/decreeRegistryService.js','utf8');
 assert.match(code,/from\(TABLE_NAMES\.DECREES\)/);
 assert.match(code,/eq\('diocese_id', dioceseId\)/);
 assert.match(code,/in\('parish_id', parishIds\)/);
 assert.match(code,/\.range\(start, start \+ PAGE_SIZE - 1\)/);
 const parish=fs.readFileSync('src/pages/parish/ParishSacramentalDecreeArchivePage.jsx','utf8');
 const chancery=fs.readFileSync('src/pages/chancery/SacramentalDecreeArchivePage.jsx','utf8');
 assert.match(parish,/listDecrees\(/);
 assert.match(chancery,/listDecrees\(/);
 assert.match(parish,/Parroquia puede/);
});
test('Las interfaces V111-V113 están conectadas y respetan la autoridad de cada rol',()=>{
 const panel=fs.readFileSync('src/components/chancery/CourtReceiptInstitutionalPanel.jsx','utf8');
 const service=fs.readFileSync('src/services/nullityCourtClarifications.js','utf8');
 const chancery=fs.readFileSync('src/pages/chancery/SacramentalDecreeArchivePage.jsx','utf8');
 const diocese=fs.readFileSync('src/pages/diocese/DiocesanDecreeOversightPage.jsx','utf8');
 assert.match(panel,/role === 'diocese'/);
 assert.match(panel,/role === 'chancery'/);
 assert.match(panel,/No[n]?inguna constancia|Ninguna constancia/);
 for(const rpc of ['get_court_receipt_dual_control_summary_v111','get_court_clarifications_v113','record_court_clarification_v112'])assert.ok(service.includes(rpc));
 assert.match(chancery,/role="chancery"/);
 assert.match(diocese,/role="diocese"/);
});
test('V113 no concede lectura directa ni acceso público',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261022030239_scoped_court_clarification_read_v113.sql','utf8');
 assert.match(sql,/SECURITY DEFINER/i);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/v_role NOT IN \('chancery','diocese'\)/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM PUBLIC,anon/i);
 assert.match(sql,/'authenticity_certified',false/);
 assert.match(sql,/'registral_effects_authorized',false/);
});
