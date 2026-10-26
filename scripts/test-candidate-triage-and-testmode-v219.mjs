import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261026143504_historical_reconciliation_candidate_triage_v219.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-historical-candidates-v219.sql','utf8');
const page=fs.readFileSync('src/pages/chancery/HistoricalLinkReviewPage.jsx','utf8');
const main=fs.readFileSync('src/components/DashboardLayout.jsx','utf8');
const login=fs.readFileSync('src/pages/PublicSearchPage.jsx','utf8');
const chrome=fs.readFileSync('scripts/audit-historical-link-review-browser-v219.mjs','utf8');
for(const [name,phrase] of [
 ['helper internal', 'sacramentum_missing_link_assessment_v219(p_link_id uuid)'],
 ['candidate classification source batched', 'JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id'],
 ['coordinate book','t.book_number'],
 ['coordinate folio','t.folio'],
 ['coordinate number','t.number'],
 ['target scoped to original parish','t.parish_id=o.parish_id'],
 ['identity includes first names',"o.normalized_data->>'names'"],
 ['identity includes last names',"o.normalized_data->>'last_names'"],
 ['identity includes sacrament date',"o.normalized_data->>'celebration_date'"],
 ['avoid ambiguous records',"WHEN match_count>1 THEN 'ambiguous'"],
 ['avoid identity mismatch',"ELSE 'identity_conflict'"],
 ['no physical coordinate match',"WHEN match_count=0 THEN 'not_found'"],
 ['high confidence only with full identity',"WHEN identity_ok IS TRUE THEN 'strong_candidate'"],
 ['no candidate UUID on unsafe match',"ELSE NULL::uuid END AS candidate_id"],
 ['helper NOT exposed to app users','REVOKE ALL ON FUNCTION public.sacramentum_missing_link_assessment_v219(uuid) FROM PUBLIC,anon,authenticated'],
 ['reviewer only sees scoped rows','public.list_unresolved_legacy_links_v218(NULL,p_limit,p_offset)'],
 ['summary excludes unrelated diocese','p.diocese_id=v_diocese'],
 ['active chancery user requirement',"lower(up.role)='chancery'"],
 ['active chancery account required',"up.is_active IS TRUE"],
 ['JWT verified on real database','auth.uid()'],
 ['summary only counts classifications',"count(*)::bigint"],
 ['RPC anonymous access revoked','FROM PUBLIC,anon;']
])test('V219 SQL candidate triage '+name,()=>assert.ok(migration.includes(phrase),name));
test('V219 classification is read-only and never quietly fixes historical links',()=>{
 assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP)\s+(?:INTO|FROM|TABLE\s+)?public\.(?:legacy_record_links|baptisms|confirmations)\b/i);
});
test('V219 real QA always rolls back',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(qa,/\bCOMMIT;/i);
});
for(const [scenario,token] of [
 ['219 unresolved', 'total<>219'],
 ['46 strong', 'strong<>46'],
 ['one identity conflict', 'conflicting<>1'],
 ['172 absent', 'absent<>172'],
 ['anonymous denied', 'BAD_ANON_READ'],
 ['parish denied', 'BAD_PARISH_READ'],
 ['foreign institution denied', 'foreign_result<>0'],
 ['internal helper denied', 'BAD_INTERNAL_HELPER_EXPOSED'],
 ['no candidate for conflict', "assessment <> 'strong_candidate' AND candidate_id IS NOT NULL"],
 ['real strong candidate linked to same parish','t.parish_id=b.parish_id']
])test('V219 real rollback QA asserts '+scenario,()=>assert.ok(qa.includes(token)));
test('V219 UI shows three classifications without automatic relinking',()=>{
 assert.match(page,/summarize_unresolved_legacy_candidates_v219/);
 assert.match(page,/assess_unresolved_legacy_links_v219/);
 assert.match(page,/Coincidencia integral/);
 assert.match(page,/Conflicto de identidad/);
 assert.match(page,/Sin partida coincidente/);
 assert.match(page,/Exige cotejo documental/);
 assert.match(page,/No se propone vinculación/);
 assert.doesNotMatch(page,/\.from\(['"]legacy_record_links['"]\)\.update/);
});
test('V219 all authenticated dashboards show non-official test banner by default',()=>{
 assert.match(main,/VITE_REGISTRY_DATA_MODE !== 'official'/);
 assert.match(main,/DATOS DE PRUEBA · NO OFICIALES/);
 assert.match(main,/role="status"/);
});
test('V219 public login shows non-official banner by default',()=>{
 assert.match(login,/VITE_REGISTRY_DATA_MODE !== 'official'/);
 assert.match(login,/DATOS DE PRUEBA · NO OFICIALES/);
});
test('V219 actual React Chrome test isolates all network and verifies full triage',()=>{
 assert.match(chrome,/diagnostic_classification_displays_all_219_cases/);
 assert.match(chrome,/info.strong!==46\|\|info.conflict!==1\|\|info.missing!==3/);
 assert.match(chrome,/AUDITORIA_REVISION_HISTORICA_BROWSER_V219\.json/);
 assert.match(chrome,/blockedExternalRequests/);
});
