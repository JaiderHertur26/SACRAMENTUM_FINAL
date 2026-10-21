import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decreeSacrament, decreeCategory, decreeEffect, decreeCanReverse, isHistoricalDecree } from '../src/utils/decreeArchiveModel.mjs';
import { buildDocumentaryDecreeHtml } from '../src/services/decreeDocumentaryHtml.mjs';

const sacraments = ['bautismo','confirmacion','matrimonio','exequias'];
let tests = 0;
const verified = (name, fn) => {
  test(name, () => { fn(); tests += 1; });
};

for (const sacrament of sacraments) {
  // Todas las identidades son ficticias: no se insertan registros en ninguna base real.
  const parishId = '00000000-0000-4000-8000-000000000101';
  const dioceseId = '00000000-0000-4000-8000-000000000999';
  const common = { parish_id:parishId,diocese_id:dioceseId,sacrament_type:sacrament,
    decree_number:'TEST-'+sacrament,decree_date:'2026-08-01',
    payload:{targetName:'PERSONA FICTICIA',reason:'Prueba interna sin valor canónico'} };
  const correction = {...common,tipo:'correccion',status:'active',original_record_id:'original',
    replacement_record_id:'replacement'};
  const replacement = {...common,tipo:'reposicion',status:'active',replacement_record_id:'replacement'};
  const legacyExecuted = {...common,tipo:'correccion',status:'archived',
    payload:{...common.payload,source:'ANULACION.DBF',legacyHistorical:true,
      issuanceMode:'legacy_decree_execution',executionReconciled:true}};
  const legacyUnverified = {...common,tipo:'correccion_legacy',status:'archived',
    payload:{...common.payload,legacyHistorical:true,decreeType:'correccion',source:'legacy_import'}};
  const documentary = {...common,tipo:'documental',status:'active',
    payload:{...common.payload,registersEffect:false,documentaryOnly:true}};
  const recovered = {...common,tipo:'documental',status:'archived',
    payload:{...common.payload,historical:true,recordOrigin:'historical_archive',
      sourceReference:'ARCHIVO FICTICIO L-1 F-8'}};
  verified(sacrament+' · clasificación de 6 expedientes ficticios',()=>{
    for (const row of [correction,replacement,legacyExecuted,legacyUnverified,documentary,recovered])
      assert.equal(decreeSacrament(row.sacrament_type),sacrament);
    assert.equal(decreeCategory(correction.tipo),'correccion');
    assert.equal(decreeCategory(replacement.tipo),'reposicion');
    assert.equal(decreeCategory(legacyUnverified.tipo,legacyUnverified.payload),'correccion');
    assert.equal(decreeCategory(documentary.tipo),'documental');
  });
  verified(sacrament+' · efectos de las partidas',()=>{
    assert.equal(decreeEffect(correction),'registral');
    assert.equal(decreeEffect(replacement),'registral');
    assert.equal(decreeEffect(legacyExecuted),'historico_ejecutado');
    assert.equal(decreeEffect(legacyUnverified),'historico_no_verificado');
    assert.equal(decreeEffect(documentary),'sin_modificacion');
    assert.equal(decreeEffect(recovered),'sin_modificacion');
  });
  verified(sacrament+' · reversión segura y roles de consulta',()=>{
    assert.equal(decreeCanReverse(correction),true);
    assert.equal(decreeCanReverse(replacement),true);
    assert.equal(decreeCanReverse({...correction,status:'reversed'}),false);
    assert.equal(decreeCanReverse(legacyExecuted),false);
    assert.equal(decreeCanReverse(legacyUnverified),false);
    assert.equal(decreeCanReverse(documentary),false);
    assert.equal(isHistoricalDecree(recovered),true);
  });
  verified(sacrament+' · constancia imprimible y procedencia verificable',()=>{
    const html = buildDocumentaryDecreeHtml({row:recovered,
      institution:{dioceseName:'DIÓCESIS DE PRUEBA'},parish:{name:'PARROQUIA DE PRUEBA'}});
    assert.match(html,/RECONSTRUCCIÓN DE DECRETO HISTÓRICO/);
    assert.match(html,/NO CONSTITUYE NUEVA EXPEDICIÓN/);
    assert.match(html,/ARCHIVO FICTICIO/);
    assert.doesNotMatch(html,/ORDENA Y AUTORIZA LA ANULACIÓN/);
    const clean = buildDocumentaryDecreeHtml({row:{...documentary,
      payload:{...documentary.payload,reason:'<img src=x onerror=alert(1)>'}}});
    assert.ok(clean.includes('&lt;img'));
    assert.ok(!clean.includes('<img src=x'));
  });
}
verified('Sin sacramento no se asigna bautismo por defecto',()=>{
  assert.equal(decreeSacrament(''),null);
  assert.equal(decreeSacrament('desconocido'),null);
});
verified('Nulidad se identifica como antecedente de tribunal, no como corrección de Cancillería',()=>{
  assert.equal(decreeCategory('nulidad_matrimonial'),'tribunal');
  assert.equal(decreeCanReverse({tipo:'nulidad_matrimonial'}),false);
});
verified('Migración documental restringida a Cancillería y sin escritura sacramental',()=>{
  const sql = readFileSync(new URL('../supabase/migrations/20261021000100_chancery_documentary_decrees_v88.sql',import.meta.url),'utf8');
  assert.match(sql,/v_role is distinct from 'chancery'/);
  assert.match(sql,/p\.diocese_id=v_diocese/);
  assert.match(sql,/affectsSacramentalRecord',false/);
  assert.doesNotMatch(sql,/update\s+public\.(baptisms|confirmations|marriages|funerals)/i);
});
verified('Migración de colisiones protege número, diócesis, parroquia y ambas partidas',()=>{
  const sql = readFileSync(new URL('../supabase/migrations/20261021000200_guard_historical_decree_identity_v88.sql',import.meta.url),'utf8');
  for (const name of ['old.diocese_id','old.parish_id','old.original_record_id','old.replacement_record_id','old.decree_number'])
    assert.ok(sql.includes(name),'Protección ausente: '+name);
});
