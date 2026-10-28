import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('V257 PostgreSQL fixture is isolated, fictional and never a migration',()=>{
  const text=fs.readFileSync('scripts/qa-v257-counter-fixture.sql','utf8');
  assert.match(text,/disposable PostgreSQL 16 fixture ONLY/);
  assert.match(text,/CREATE ROLE authenticated/);
  assert.match(text,/CREATE TABLE public\.registry_audit_log/);
  assert.match(text,/CREATE TRIGGER qa_fail_audit_v257/);
  assert.match(text,/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,authenticated,anon/);
});
test('V257 SQL RPC is exercised with four sacramental cases and concurrency',()=>{
  const text=fs.readFileSync('scripts/ci-boleta-counter-v257.sh','utf8');
  for(const token of ['qa-v257-counter-fixture.sql','staged-v256-boleta-counter-rpc.sql',
    'has_table_privilege','has_function_privilege','anon','chancery','reject as_auth',
    'for sacrament in confirmacion matrimonio exequias','pid1=$!','pid2=$!',
    'winners=0','qa.fail_audit','registry_audit_log','0001A']){
    assert.ok(text.includes(token),'Missing V257 test guard: '+token);
  }
  assert.match(text,/db=sacramentum_counter_fixture_v257/);
  assert.match(text,/PG_CONTAINER:\?/);
});
test('V257 SQL fixture runs only in isolated GitHub PG16 CI',()=>{
  const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
  assert.match(workflow,/image: postgres:16/);
  assert.match(workflow,/PG_CONTAINER: \$\{\{ job\.services\.postgres\.id \}\}/);
  assert.match(workflow,/bash scripts\/ci-boleta-counter-v257\.sh/);
});
test('V257 staged RPC never updates registry numbers or sacramental memories',()=>{
  const sql=fs.readFileSync('scripts/staged-v256-boleta-counter-rpc.sql','utf8');
  assert.match(sql,/NO EJECUTAR EN SUPABASE/);
  assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/public\.current_app_parish_id/);
  assert.match(sql,/up\.is_active IS TRUE/);
  assert.match(sql,/v_new_num<=v_old_num/);
  assert.match(sql,/v_new_num < v_min_num/);
  assert.match(sql,/INSERT INTO public\.registry_audit_log/);
  assert.doesNotMatch(sql,/UPDATE public\.(baptisms|confirmations|marriages|funerals|decretos)/i);
  assert.doesNotMatch(sql,/UPDATE sacramentum_ledger\./i);
});
