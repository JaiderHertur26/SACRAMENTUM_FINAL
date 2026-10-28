import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');

test('V258 active parameter screens and unsealed helpers reject obsolete writes',()=>{
  const source=read('src/services/sacramentParametersService.js');
  const funeralCloud=read('src/services/funeralService.js');
  const funerals=read('src/services/funeralsService.js');
  assert.match(source,/rejectPhysicalParameterWrite/);
  for(const method of ['saveBaptismParameters','saveConfirmationParameters',
    'saveMatrimonioParameters','updateExequiasParameters']){
    assert.match(source,new RegExp('export const '+method+'.*rejectPhysicalParameterWrite'));
  }
  // V207 seals the original boleta service by hash: preserve that file intact.
  // The obsolete save helper is no longer imported by any parameter screen.
  assert.match(funeralCloud,/export const saveFuneralParametersCloud/);
  for(const file of ['BaptismParametersPage.jsx','ConfirmationParametersPage.jsx',
    'MatrimonioParametersPage.jsx']) {
    assert.doesNotMatch(read('src/pages/parish/'+file),/saveFuneralParametersCloud/);
  }
  assert.match(funerals,/export async function updateFuneralParameters\(\)/);
  assert.doesNotMatch(source,/\.rpc\('save_(baptism|confirmation|marriage|funeral)_parameters'/);
  assert.doesNotMatch(funerals,/\.update\(\{ exequias_params/);
  assert.doesNotMatch(funerals,/\.from\(TABLE_NAMES\.PARISH_PARAMETERS\)\.insert/);
});
test('V258 staged atomic ACL closes mutator policies, grants and four old save RPCs',()=>{
  const sql=read('scripts/staged-v258-parameter-lockdown.sql');
  for(const token of ['BEGIN;', 'COMMIT;', 'SET LOCAL lock_timeout',
    'update_parish_boleta_counter_v256','parish_parameters_insert_owner',
    'parish_parameters_update_owner','parish_parameters_delete_owner',
    'save_baptism_parameters','save_confirmation_parameters','save_marriage_parameters',
    'save_funeral_parameters','REVOKE INSERT,UPDATE,DELETE','GRANT SELECT',
    'authenticat','anon']){
    assert.ok(sql.includes(token),'Missing safe cutover: '+token);
  }
  assert.match(sql,/prosecdef IS TRUE/);
  assert.match(sql,/IF NOT EXISTS[\s\S]*relrowsecurity/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.save_baptism_parameters/);
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM public\.|UPDATE public\.parish_parameters SET|DROP FUNCTION/i);
});
test('V258 fixture asserts retention of existing 8 business RPCs and scoped SELECT',()=>{
  const script=read('scripts/ci-parameter-lockdown-v258.sh');
  for(const token of ['qa-v257-counter-fixture.sql','qa-v258-lockdown-surface.sql',
    'staged-v256-boleta-counter-rpc.sql','staged-v258-parameter-lockdown.sql',
    'create_pending_baptism','create_pending_confirmation','create_pending_marriage',
    'create_pending_funeral','seat_baptism_records','seat_confirmation_records',
    'seat_pending_marriage','seat_funeral_record','has_table_privilege',
    'has_function_privilege','public.parish_parameters','0001A','registry_audit_log']){
      assert.ok(script.includes(token),'Missing PG16 assertion '+token);
  }
  assert.match(script,/db=sacramentum_acl_fixture_v258/);
  assert.match(script,/reject as_auth "UPDATE public\.parish_parameters/);
  assert.match(script,/SELECT count\(\*\) FROM pg_policies/);
  const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
  assert.match(workflow,/bash scripts\/ci-parameter-lockdown-v258\.sh/);
});
test('V258 never changes original registry coordinates or historic records',()=>{
  const sql=read('scripts/staged-v258-parameter-lockdown.sql');
  assert.doesNotMatch(sql,/(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:public\.)?(baptisms|confirmations|marriages|funerals|decretos|legacy_archive_records)/i);
  assert.doesNotMatch(sql,/sacramentum_ledger\.(?:book_memories|active_seats)\s+(?:SET|WHERE)/i);
});
