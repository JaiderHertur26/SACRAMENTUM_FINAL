import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('scripts/qa-v252-ledger-memory-schema.sql','utf8');
const bash=fs.readFileSync('scripts/ci-ledger-schema-v252.sh','utf8');
const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
test('V252 private PostgreSQL schema is not an auto-applied live migration',()=>{
 assert.match(sql,/NOT a Supabase migration/);
 assert.match(sql,/CREATE SCHEMA IF NOT EXISTS sacramentum_ledger/);
 assert.match(sql,/REVOKE ALL ON SCHEMA sacramentum_ledger FROM PUBLIC/);
 assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA sacramentum_ledger FROM PUBLIC/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/g);
 assert.doesNotMatch(sql,/GRANT\s+\w+\s+ON\s+.+\s+TO\s+(anon|authenticated)/i);
});
test('V252 alphanumeric books, positive counts, versioned zero-entry reset and duplicate protections',()=>{
 assert.match(sql,/book_code text NOT NULL CHECK/);
 assert.match(sql,/canonical_code text GENERATED ALWAYS AS/);
 assert.match(sql,/UNIQUE INDEX uq_v252_active_book_scope/);
 assert.match(sql,/WHERE retired_at IS NULL/);
 assert.match(sql,/partidas_per_folio integer NOT NULL CHECK/);
 assert.match(sql,/CREATE TRIGGER t_v252_lock_book_memory/);
 assert.match(sql,/NEW\.partidas_per_folio IS DISTINCT FROM OLD\.partidas_per_folio/);
});
test('V252 historical event ledger protects row mutability and stores legal reversal',()=>{
 assert.match(sql,/CREATE TABLE sacramentum_ledger\.seat_events/);
 assert.match(sql,/BEFORE UPDATE OR DELETE ON sacramentum_ledger\.seat_events/);
 assert.match(sql,/authorization_reference/);
 assert.match(sql,/reason text/);
 assert.match(sql,/ck_v252_event_math/);
 assert.match(sql,/REFERENCES sacramentum_ledger\.book_memories\(id\) ON DELETE RESTRICT/);
});
test('V252 SQL is tested on throwaway PostgreSQL16 and never connects to QA or official DB',()=>{
 assert.match(workflow,/ensayo-esquema-libros-v252:/);
 assert.match(workflow,/image:\s*postgres:16/);
 assert.match(workflow,/bash scripts\/ci-ledger-schema-v252\.sh/);
 assert.match(bash,/CREATE DATABASE \$db/);
 assert.match(bash,/src|v252|postgres/i);
 assert.doesNotMatch(bash,/SUPABASE_|service_role|https:/);
 assert.match(bash,/immutable event modification/);
 assert.match(bash,/normalized duplicate book 0001/);
 assert.match(bash,/unauthorized schema read/);
});
test('V252 SQL design does not implement live sequencing or existing procedural overrides',()=>{
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.(?:seat_baptism_records|seat_confirmation_records|seat_pending_marriage|seat_funeral_record)/i);
 assert.doesNotMatch(sql,/\bDELETE FROM public\./i);
});
test('V252 SQL and pure logic checks are mandatory in audit master + CI',()=>{
 for(const f of ['scripts/audit-gate-v90.mjs','.github/workflows/sacramentum-auditoria-v90.yml']){
  const content=fs.readFileSync(f,'utf8');
  assert.match(content,/test-ledger-memory-v252\.mjs/);
  assert.match(content,/test-decree-chronology-v252\.mjs/);
  assert.match(content,/test-postgres-book-ledger-schema-v252\.mjs/);
 }
});
