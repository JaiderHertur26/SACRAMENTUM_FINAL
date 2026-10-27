import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
const drill=fs.readFileSync('scripts/ci-postgres-restore-drill-v247.sh','utf8');
const fixture=fs.readFileSync('scripts/fixtures/restore-drill-v247.sql','utf8');
const integrity=fs.readFileSync('scripts/fixtures/restore-integrity-v247.sql','utf8');

test('V247 mandatory isolated PostgreSQL 16 job, no Supabase secrets',()=>{
 assert.match(workflow,/ensayo-restauracion-postgres-v247:/);
 assert.match(workflow,/image:\s*postgres:16/);
 assert.match(workflow,/job\.services\.postgres\.id/);
 assert.match(workflow,/bash scripts\/ci-postgres-restore-drill-v247\.sh/);
 assert.doesNotMatch(drill,/SUPABASE_(?:DB|SERVICE|KEY|URL|ANON)/);
});
test('V247 performs actual pg_dump custom and transactional pg_restore in two distinct DBs',()=>{
 assert.match(drill,/pg pg_dump -U postgres -Fc -d sacramentum_fixture_source/);
 assert.match(drill,/pg pg_restore --exit-on-error --single-transaction --no-owner -U postgres -d sacramentum_fixture_restore/);
 assert.match(drill,/CREATE DATABASE sacramentum_fixture_source/);
 assert.match(drill,/CREATE DATABASE sacramentum_fixture_restore/);
 assert.match(drill,/mktemp -d/);
 assert.match(drill,/trap 'rm -rf/);
});
test('V247 validates row counts, SHA256, corruption and deterministic equality',()=>{
 assert.match(drill,/src_counts/);
 assert.match(drill,/dst_counts/);
 assert.match(drill,/sha256sum --check --status/);
 assert.match(drill,/corrupted.dump/);
 assert.match(drill,/src_digest/);
 assert.match(drill,/dst_digest/);
 assert.match(integrity,/md5\(concat_ws\(/);
 assert.match(drill,/3:5:3:2/);
});
test('V247 checks reinstated RLS, uniqueness, foreign keys and access after restore',()=>{
 assert.match(fixture,/ENABLE ROW LEVEL SECURITY/);
 assert.match(fixture,/CREATE POLICY fixture_parish_reader/);
 assert.match(fixture,/REFERENCES public.fixture_registers/);
 assert.match(fixture,/UNIQUE\(parish_id,sacrament,book,folio,number\)/);
 assert.match(drill,/SET LOCAL ROLE fixture_reader/);
 assert.match(drill,/DOES-NOT-EXIST/);
 assert.match(drill,/Restored unique coordinates/);
});
test('V247 cannot be mistaken for a restore of live data or certification of all SACRAMENTUM',()=>{
 assert.match(fixture,/datos 100 % ficticios/);
 assert.match(drill,/does NOT restore a real Supabase backup/);
 assert.doesNotMatch(fixture,/INSERT INTO public\.baptisms\b/i);
 assert.doesNotMatch(fixture,/INSERT INTO public\.auth\.users\b/i);
});
test('V247 rehearsal is registered in static audits without claiming operation official',()=>{
 for(const file of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml'])
  assert.match(fs.readFileSync(file,'utf8'),/scripts\/test-postgres-restore-drill-v247\.mjs/);
});
