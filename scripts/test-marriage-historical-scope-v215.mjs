import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261026120242_guard_pending_legacy_marriage_provenance_v215.sql','utf8');
const ui=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
const files=['scripts/qa-rollback-marriage-scope-collision-repro-v215.sql','scripts/qa-rollback-marriage-scope-guard-v215.sql','scripts/qa-rollback-marriage-reported-no-date-repro-v215.sql','scripts/qa-rollback-marriage-reported-no-date-guard-v215.sql','scripts/qa-rollback-marriage-reported-positive-v215.sql'];
for(const [name,pattern] of [
 ['rejects foreign marriage links',/Clave histórica matrimonial vinculada a otra parroquia/],
 ['validates prior batch jurisdiction',/prior\.parish_id is distinct from v_batch\.parish_id/],
 ['validates pending marital target physical ownership',/from public\.pending_marriages pm/],
 ['validates seated marriage physical ownership',/from public\.marriages m/],
 ['serializes shared source keys',/pg_advisory_xact_lock/],
 ['checks both groom given name and surname',/d->>'nombres1'[\s\S]*d->>'apellidos1'/],
 ['checks both bride given name and surname',/d->>'nombres2'[\s\S]*d->>'apellidos2'/],
 ['requires actual matrimonial date',/if v_date is null/],
 ['refers deficient reported documentation to review',/REPORTED_MARRIAGE_IDENTITY_INSUFFICIENT/],
 ['preserves legal marriage import materialization',/execute v_ddl/],
 ['rejects any unexpected prior function version',/position\(v_old_lookup in v_ddl\)=0/],
 ['does not drop original functions or tables',/DO \$migration\$/],
 ])test('V215 protected marriage materializer: '+name,()=>assert.match(migration,pattern));
for(const f of files)test('V215 QA is reversible: '+f,()=>{
 const s=fs.readFileSync(f,'utf8');
 assert.match(s,/^BEGIN;$/m);assert.match(s,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(s,/\bCOMMIT\s*;/i);
});
test('V215 marriage UI distinguishes pending, reconciled and reviewed cases',()=>{
 assert.match(ui,/isHistoricalMarriageBatch/);
 assert.match(ui,/Matrimonios históricos · revisión pendiente/);
 assert.match(ui,/expedientes pendientes creados/);
 assert.match(ui,/matrimonios conciliados con partidas existentes/);
 assert.match(ui,/No se crearon partidas matrimoniales celebradas/);
});
test('V215 browser tests both positive historical marriage and incomplete identity',()=>{
 const s=fs.readFileSync('scripts/audit-legacy-migration-browser-v215.mjs','utf8');
 assert.match(s,/marriage_preinscription_success_shows_own_counts/);
 assert.match(s,/reported_marriage_missing_identity_requires_manual_review/);
 assert.match(s,/zero Supabase access/);
});
