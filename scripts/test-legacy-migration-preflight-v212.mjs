import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateLegacyMigrationDraft,validateLegacyMigrationBatch} from '../src/utils/legacyMigrationPreflight.mjs';
import {analyzeLegacyRow} from '../src/config/legacyImportProfiles.js';
const hash='a'.repeat(64);
const pA={id:'a',diocese_id:'diocese-A',name:'Parroquia A'};
const pB={id:'b',diocese_id:'diocese-B',name:'Parroquia B'};
const draft={role:'diocese',dioceseId:'diocese-A',file:{name:'BAUTIZOS.json'},hash,
 profileKey:'BAUTIZOS',analyzedProfileKey:'BAUTIZOS',
 analysis:[{target_entity:'baptism',status:'valid'}],
 parishId:'a',parishes:[pA,pB],expectedEntity:'baptism'};
const batch={id:'batch-1',profile_key:'BAUTIZOS',diocese_id:'diocese-A',parish_id:'a'};
const finish={batch,role:'diocese',dioceseId:'diocese-A',parishes:[pA,pB],selectedParishId:'a'};
test('V212 valid diocesan staging succeeds only in its parish',()=>{const x=validateLegacyMigrationDraft(draft);assert.equal(x.ok,true);assert.equal(x.parish.id,'a')});
test('V212 valid General Admin staging permits another diocese explicitly',()=>assert.equal(validateLegacyMigrationDraft({...draft,role:'admin_general',dioceseId:null,parishId:'b'}).ok,true));
const failures=[
 ['foreign parish', {parishId:'b'},'otra diócesis'],
 ['unknown parish', {parishId:'x'},'no pertenece'],
 ['absent parish', {parishId:''},'Seleccione'],
 ['unknown role', {role:'parish'},'no puede'],
 ['unidentified diocese', {dioceseId:null},'No se identificó'],
 ['file absent', {file:null},'JSON válido'],
 ['invalid hash', {hash:'weak'},'JSON válido'],
 ['file absent name', {file:{}},'JSON válido'],
 ['profile changed after analysis', {profileKey:'CONFIRMA'},'Reanalizar'],
 ['analysis has other target', {analysis:[{target_entity:'confirmation'}]},'normalizados'],
 ['mixed normalized batch', {analysis:[{target_entity:'baptism'},{target_entity:'marriage'}]},'normalizados'],
 ['empty analysis', {analysis:[]},'normalizados'],
 ['unknown entity', {expectedEntity:null},'normalizados'],
 ['analysis absent', {analysis:null},'normalizados']
];
for(const [label,patch,fragment] of failures)test('V212 fail closed draft: '+label,()=>{const x=validateLegacyMigrationDraft({...draft,...patch});assert.equal(x.ok,false);assert.ok(x.reason.includes(fragment),x.reason)});
test('V212 valid staged batch can be applied in the original parish',()=>{const x=validateLegacyMigrationBatch(finish);assert.equal(x.ok,true);assert.equal(x.parish.id,'a')});
for(const [label,patch] of [
 ['unauthorized role',{role:'parish'}],
 ['missing diocese',{dioceseId:null}],
 ['missing batch',{batch:null}],
 ['unidentified target parish',{batch:{...batch,parish_id:null}}],
 ['missing profile',{batch:{...batch,profile_key:null}}],
 ['changed parish',{selectedParishId:'b'}],
 ['foreign batch',{batch:{...batch,diocese_id:'diocese-B'}}],
 ['absent parish in list',{parishes:[]}],
 ['forged target',{batch:{...batch,parish_id:'b'}}]
])test('V212 fail closed applying: '+label,()=>assert.equal(validateLegacyMigrationBatch({...finish,...patch}).ok,false));
test('V212 all cases are supplementary to server RPC ownership',()=>{const s=fs.readFileSync('src/services/legacyMigrationService.js','utf8');assert.match(s,/rpc\('create_legacy_import_batch'/);assert.match(s,/rpc\('stage_legacy_import_rows'/);assert.match(s,/apply_legacy_import_batch_v3/)});
test('V212 migration page binds analyzed profile and staged scope before every call',()=>{const s=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');assert.match(s,/validateLegacyMigrationDraft\(/);assert.match(s,/validateLegacyMigrationBatch\(/);assert.match(s,/needsReanalysis/);assert.match(s,/fileReadSequence\.current/);assert.match(s,/checked\.parish/);});
test('V212 UI warns when batch is stalled, never declares success',()=>{const s=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');assert.match(s,/result\.stalled \|\| Number\(result\.remaining/);assert.match(s,/Importación parcial/);});
test('V212 service stops stalled batch and signals caller',()=>{const s=fs.readFileSync('src/services/legacyMigrationService.js','utf8');assert.match(s,/stalled = true/);assert.match(s,/remaining,\s*stalled,/);assert.match(s,/iterations > 5000/);});
for(const profileKey of ['INSBAUTI','INSCONFI']){
 for(const [flag,expected] of [['1',true],['0',false]]){
  test('V212 '+profileKey+' reported '+flag+' is preserved as pending, not automatically seated',()=>{
   const row=analyzeLegacyRow(profileKey,{numero:'000001',fecins:'2020-01-01',fecbau:'2020-01-02',feccon:'2020-01-03',apellidos:'FICTICIO',nombres:'ENSAYO',reported:flag},0);
   assert.equal(row.normalized_data.reported,expected);
   assert.equal(row.target_entity,profileKey==='INSBAUTI'?'pending_baptism':'pending_confirmation');
   assert.equal(row.status,'valid');
   assert.ok(row.issue_codes.includes(expected?'LEGACY_BOLETA_REPORTED':'LEGACY_BOLETA_NOT_SEATED'));
   assert.equal(row.original_data.reported,flag);
  });
 }
}
test('V212 archival ANULACION never directly updates sacramental records',()=>{
 const src=fs.readFileSync('src/services/legacyMigrationService.js','utf8');
 assert.match(src,/effectiveProfile === 'ANULACION'/);
 assert.match(src,/decretos históricos ANULACION deben conciliarse desde Cancillería/);
});
