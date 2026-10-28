import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COUNTER_SACRAMENTS, validateBoletaCounter, resolveBoletaCounterChange
} from '../src/domain/boletaCounterPolicy.mjs';

const read=file=>fs.readFileSync(file,'utf8');

test('V256 counter: only digits, correct zero padding and no numerical rollback',()=>{
  assert.deepEqual(COUNTER_SACRAMENTS,['bautismo','confirmacion','matrimonio','exequias']);
  assert.equal(validateBoletaCounter('00000031'),'00000031');
  for(const bad of ['', '  ', '001A', '-1', '1.5', '1234567890123', '1 2']) {
    assert.throws(()=>validateBoletaCounter(bad), /dígitos/);
  }
  assert.deepEqual(resolveBoletaCounterChange('000009','000010'),{expected:'000009',next:'000010'});
  for(const next of ['9','000009','000008','8']){
    assert.throws(()=>resolveBoletaCounterChange('000009',next),/avanzar/);
  }
});
test('V256 four parameter screens render one consultative component',()=>{
  for(const [file,sacrament] of [
    ['BaptismParametersPage.jsx','bautismo'],
    ['ConfirmationParametersPage.jsx','confirmacion'],
    ['MatrimonioParametersPage.jsx','matrimonio']
  ]){
    const src=read('src/pages/parish/'+file);
    assert.match(src,/ParishParametersEvidencePage/);
    assert.doesNotMatch(src,/saveBaptismParameters|saveConfirmationParameters|saveMatrimonioParameters|saveFuneralParametersCloud|saveParameterSet|\.update\(/);
    if(sacrament!=='bautismo') assert.match(src,new RegExp('sacrament="'+sacrament+'"'));
  }
  const baptism=read('src/pages/parish/BaptismParametersPage.jsx');
  assert.match(baptism,/tab=exequias|'exequias'/);
});
test('V256 parameter evidence has no manual controls for physical coordinates',()=>{
  const src=read('src/components/parish/ParishParametersEvidencePage.jsx');
  assert.match(src,/loadParishParameterEvidence/);
  assert.match(src,/saveBoletaCounter/);
  assert.match(src,/numeroRegistroActual/);
  assert.match(src,/fields\.map/);
  assert.match(src,/Solo se modificará el número de registro de boletas/);
  assert.doesNotMatch(src,/saveBaptismParameters|saveConfirmationParameters|saveMatrimonioParameters|saveFuneralParametersCloud/);
  assert.doesNotMatch(src,/setParams\(\(prev|setCloudParams|handleCloudChange/);
});
test('V256 service reads source of truth and fails closed when exclusive RPC is absent',()=>{
  const src=read('src/services/parishParameterEvidenceService.js');
  assert.match(src,/\.from\('parish_parameters'\)/);
  assert.match(src,/\.eq\('parish_id', parishId\)/);
  assert.match(src,/maybeSingle\(\)/);
  assert.match(src,/update_parish_boleta_counter_v256/);
  assert.match(src,/resolveBoletaCounterChange/);
  assert.doesNotMatch(src,/save_baptism_parameters|save_confirmation_parameters|save_marriage_parameters|save_funeral_parameters|\.update\(|\.insert\(/);
});
test('V256 staged exclusive RPC verifies ownership, CAS, monotonicity, and audit event',()=>{
  const sql=read('scripts/staged-v256-boleta-counter-rpc.sql');
  for(const pattern of [
    /NO EJECUTAR EN SUPABASE/,/SECURITY DEFINER SET search_path TO ''/,
    /public\.current_app_parish_id\(\)/,/public\.current_app_role\(\)/,
    /up\.is_active IS TRUE/,/FOR UPDATE/,/40001/,
    /v_new_num<=v_old_num/,/v_new_num < v_min_num/,
    /jsonb_set\(v_current,'\{numeroRegistroActual\}'/,
    /INSERT INTO public\.registry_audit_log/,
    /REVOKE ALL ON FUNCTION public\.update_parish_boleta_counter_v256/,
    /GRANT EXECUTE ON FUNCTION public\.update_parish_boleta_counter_v256/
  ]) assert.match(sql,pattern);
  assert.doesNotMatch(sql,/UPDATE public\.(?:baptisms|confirmations|marriages|funerals)/i);
  assert.doesNotMatch(sql,/UPDATE sacramentum_ledger\.book_memories/i);
});
test('V256 staging stays isolated until broad writes and four seat RPCs are retired',()=>{
  const sql=read('scripts/staged-v256-boleta-counter-rpc.sql');
  assert.match(sql,/REVOKES broad direct table writes/);
  assert.match(sql,/legacy save_\* RPCs/);
  const history=read('CONTINUIDAD_ASIENTOS_Y_DECRETOS_V255_2026-10-28.md');
  assert.match(history,/Los cuatro RPC reales/);
});
