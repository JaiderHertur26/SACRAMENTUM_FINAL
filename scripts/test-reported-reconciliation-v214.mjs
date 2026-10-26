import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261026044654_require_reported_legacy_identity_v214.sql','utf8');
const ui=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
const sqlPositive=fs.readFileSync('scripts/qa-rollback-reported-reconciliation-v214.sql','utf8');
const sqlRepro=fs.readFileSync('scripts/qa-rollback-reported-insufficient-identity-repro-v214.sql','utf8');
const sqlGuard=fs.readFileSync('scripts/qa-rollback-reported-insufficient-identity-guard-v214.sql','utf8');
for(const [name,value] of [
 ['reported legacy boleta requires full first names', "nullif(btrim(coalesce(d->>'names','')),'') is null"],
 ['reported legacy boleta requires full surnames', "nullif(btrim(coalesce(d->>'last_names','')),'') is null"],
 ['reported legacy boleta requires celebration or birth date',"v_date is null and v_birth is null"],
 ['insufficient identity cannot be imported', "status='review'"],
 ['auditable issue code in registry',"REPORTED_IDENTITY_INSUFFICIENT"],
 ['read-only review reason',"missing_full_name_or_verifiable_date"],
 ['must not turn reported into unreported pending', "v_reviewed := v_reviewed + 1;"],
 ['V213 parish guard preserved before identity changes',"Clave histórica vinculada a otra parroquia"],
 ['migration fails when source materializer unexpected',"position(v_old in v_ddl)=0"],
 ['migration preserves full function logic',"execute replace(v_ddl,v_old,v_new)"]
])test('V214 SQL identity guard: '+name,()=>assert.ok(migration.includes(value),name));
test('V214 evidence of reported boletas uniquely finding celebrated counterparts',()=>{
 assert.match(sqlPositive,/celebrated_unique_links/);
 assert.match(sqlPositive,/REPORTED_PARTIDA_AMBIGUOUS/);
 assert.match(sqlPositive,/REPORTED_PARTIDA_NOT_FOUND/);
 assert.match(sqlPositive,/retries_idempotent/);
});
test('V214 positive SQL tests cover both baptism and confirmation with real records',()=>{
 for(const t of ['public.baptisms','public.confirmations',"'INSBAUTI','INSCONFI'"])assert.ok(sqlPositive.includes(t),t);
});
test('V214 reproduction and fixed result are both reversible and fail closed',()=>{
 for(const s of [sqlPositive,sqlRepro,sqlGuard]){
 assert.match(s,/^BEGIN;$/m);assert.match(s,/^ROLLBACK;\s*$/m);assert.doesNotMatch(s,/\bCOMMIT\s*;/i);
 }
 assert.match(sqlRepro,/missing_identity_incorrectly_reconciled/);
 assert.match(sqlGuard,/insufficient_identity_sent_to_review/);
 assert.match(sqlGuard,/incorrect_links/);
});
test('V214 import UI displays pending, reconciled and reviewed boletas separately',()=>{
 assert.match(ui,/Pendientes creados \$\{p.imported\}/);
 assert.match(ui,/partidas conciliadas \$\{p.reconciled\}/);
 assert.match(ui,/revisión manual \$\{p.reviewed\}/);
 assert.match(ui,/Boletas procesadas · revisión pendiente/);
 assert.match(ui,/No se crearon partidas celebradas/);
});
test('V214 browser uses source production React with mocks only',()=>{
 const s=fs.readFileSync('scripts/audit-legacy-migration-browser-v214.mjs','utf8');
 const v=fs.readFileSync('scripts/qa-v212-migration/vite.config.mjs','utf8');
 assert.match(s,/reported_reconciliation_success_is_separated_from_pending_creations/);
 assert.match(s,/reported_identity_review_is_not_misrepresented_as_success/);
 assert.match(v,/mockMigration\.js/);
 assert.doesNotMatch(s,/createClient\(/);
});
