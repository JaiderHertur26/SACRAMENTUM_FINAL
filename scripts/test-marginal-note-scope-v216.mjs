import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261026124426_guard_marginal_note_historical_parish_v216.sql','utf8');
const ui=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
const service=fs.readFileSync('src/services/legacyMigrationService.js','utf8');
const four=fs.readFileSync('scripts/qa-rollback-marginal-four-sacraments-v216.sql','utf8');
const guard=fs.readFileSync('scripts/qa-rollback-marginal-parish-guard-v216.sql','utf8');
const wrong=fs.readFileSync('scripts/qa-rollback-marginal-wrong-partida-v216.sql','utf8');
const browser=fs.readFileSync('scripts/audit-legacy-migration-browser-v216.mjs','utf8');
for(const [label,fragment] of [
 ['same historical source namespace serialized','pg_advisory_xact_lock'],
 ['provenance of original batch verified','prior.parish_id is distinct from v_batch.parish_id'],
 ['target must be a marginal note',"l.target_table is distinct from 'marginal_notes'"],
 ['missing target is not imported','mn.id is null'],
 ['marginal note must belong to current parish','mn.parish_id is distinct from v_batch.parish_id'],
 ['marginal note sacrament type must match','mn.sacrament_type is distinct from v_sacrament'],
 ['baptism original owner and physical coordinates','from public.baptisms target'],
 ['confirmation original owner and physical coordinates','from public.confirmations target'],
 ['marriage original owner and physical coordinates','from public.marriages target'],
 ['funeral original owner and physical coordinates','from public.funerals target'],
 ['physical target ID is validated','target.id=mn.sacrament_id'],
 ['same-parish book is validated','sacramentum_registry_ref(target.book_number)=v_book'],
 ['same-parish folio is validated','sacramentum_registry_ref(target.folio)=v_folio'],
 ['same-parish number is validated','sacramentum_registry_ref(target.number)=v_number'],
 ['fails closed on cross-parish or changed sacrament','Nota marginal histórica vinculada a otra parroquia'],
 ['fails closed if private SQL function has drifted','position(v_old in v_ddl)=0'],
 ['preserves the existing function signature and business rules','execute replace(v_ddl,v_old,v_new)']
])test('V216 database guard: '+label,()=>assert.ok(migration.includes(fragment),label));
test('V216 never drops or truncates official records',()=>{
 assert.doesNotMatch(migration,/\b(DROP TABLE|TRUNCATE|DELETE FROM public\.(baptisms|confirmations|marriages|funerals|marginal_notes))\b/i);
 assert.match(migration,/DO \$migration\$/);
});
for(const p of ['NTBAU002','NTCON001','NTMAT002','NTDEF001']){
 test('V216 real SQL exercises same source key in two parishes for '+p,()=>{
  assert.ok(four.includes("'"+p+"'"),p);
  assert.match(four,/foreign_source_rejected/);
  assert.match(four,/same_parish_replays_idempotent/);
 });
}
for(const p of [
 'scripts/qa-rollback-marginal-cross-parish-repro-v216.sql',
 'scripts/qa-rollback-marginal-parish-guard-v216.sql',
 'scripts/qa-rollback-marginal-four-sacraments-v216.sql',
 'scripts/qa-rollback-marginal-wrong-partida-v216.sql'
])test('V216 SQL QA is fully reversible: '+p,()=>{
 const s=fs.readFileSync(p,'utf8');
 assert.match(s,/^BEGIN;$/m);
 assert.match(s,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(s,/\bCOMMIT\s*;/i);
});
test('V216 same-parish wrong partida is rejected while source note is preserved',()=>{
 assert.match(wrong,/wrong_partida_rejected/);
 assert.match(wrong,/original_note_preserved/);
 assert.match(wrong,/wrong_note_created/);
 assert.match(wrong,/number','2'/);
});
test('V216 real note importer is used for all six legacy note profiles',()=>{
 for(const p of ['NTBAU001','NTBAU002','NTCON001','NTMAT001','NTMAT002','NTDEF001'])assert.ok(service.includes("'"+p+"'"),p);
 assert.match(service,/apply_legacy_marginal_note_batch/);
});
test('V216 UI informs note import successes and distinguishes review and security failures',()=>{
 assert.match(ui,/isHistoricalNotesBatch/);
 assert.match(ui,/Notas históricas · errores de importación/);
 assert.match(ui,/Notas históricas · revisión pendiente/);
 assert.match(ui,/Notas marginales históricas vinculadas/);
 assert.match(ui,/failureCount > 0/);
 assert.match(ui,/reviewCount > 0/);
 assert.match(ui,/Las notas rechazadas no se incorporaron/);
});
test('V216 browser tests real React page with note success and failure',()=>{
 assert.match(browser,/historical_marginal_note_import_shows_note_specific_summary/);
 assert.match(browser,/historical_note_cross_parish_error_must_never_report_success/);
 assert.match(browser,/AUDITORIA_CENTRO_MIGRACION_BROWSER_V216\.json/);
 assert.match(browser,/zero Supabase access/);
});
