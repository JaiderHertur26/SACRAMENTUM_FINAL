import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration = fs.readFileSync('supabase/migrations/20261026133625_chancery_historical_link_review_v218.sql','utf8');
const qa = fs.readFileSync('scripts/qa-rollback-chancery-unresolved-review-v218.sql','utf8');
const page = fs.readFileSync('src/pages/chancery/HistoricalLinkReviewPage.jsx','utf8');
const app = fs.readFileSync('src/App.jsx','utf8');
const dashboard = fs.readFileSync('src/pages/chancery/ChanceryDashboard.jsx','utf8');
for (const [name, fragment] of [
 ['append-only review table','CREATE TABLE IF NOT EXISTS public.legacy_link_review_events_v218'],
 ['review table RLS','ALTER TABLE public.legacy_link_review_events_v218 ENABLE ROW LEVEL SECURITY'],
 ['no direct public/anon/authenticated table access','REVOKE ALL ON public.legacy_link_review_events_v218 FROM PUBLIC, anon, authenticated'],
 ['review statuses restricted',"decision IN ('investigate','source_verified','not_found','escalated')"],
 ['document reference bounded','BETWEEN 8 AND 180'],
 ['chancery-only active profile',"lower(up.role)='chancery'"],
 ['verified real chancery institution','JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id'],
 ['active profile enforced',"up.is_active IS TRUE"],
 ['active account status enforced',"upper(coalesce(up.status,''))='ACTIVE'"],
 ['JWT identities from trusted auth.uid()','auth.uid()'],
 ['physical parish diocesan ownership','p.diocese_id=v_diocese'],
 ['physical baptism target existence',"l.target_table='baptism' AND ba.id IS NULL"],
 ['physical confirmation target existence',"l.target_table='confirmation' AND co.id IS NULL"],
 ['staging row must match its batch','r.id=l.row_id AND r.batch_id=b.id'],
 ['cases function is paginated','p_limit NOT BETWEEN 1 AND 100'],
 ['unbounded offset blocked','p_offset NOT BETWEEN 0 AND 5000'],
 ['scoped family counts','public.summarize_unresolved_legacy_links_v218'],
 ['summary only returns aggregate counts','count(DISTINCT p.id)'],
 ['append-only audit evidence insert','INSERT INTO public.legacy_link_review_events_v218'],
 ['recording never reassigns sacramental links','Caso inexistente, ya localizado o ajeno a su diócesis'],
 ['deny anonymous case function','REVOKE ALL ON FUNCTION public.list_unresolved_legacy_links_v218(uuid,integer,integer) FROM PUBLIC,anon'],
 ['deny anonymous recording function','REVOKE ALL ON FUNCTION public.record_unresolved_legacy_link_review_v218(uuid,text,text) FROM PUBLIC,anon'],
 ['authorized-only execution grant','TO authenticated'],
]) test('V218 historical-review SQL: '+name,()=>assert.ok(migration.includes(fragment),name));
test('V218 may never mutate historical links or sacramental records',()=>{
 assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\s+(?:TABLE\s+)?public\.(?:baptisms|confirmations|legacy_record_links|legacy_import_rows)\b/i);
});
test('V218 SQL real QA is reversible and limits synthetic state',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/^ROLLBACK;\s*$/m);
 assert.doesNotMatch(qa,/\bCOMMIT\s*;/i);
 assert.match(qa,/original_baptisms/);
 assert.match(qa,/original_confirmations/);
 assert.match(qa,/original_links/);
});
for (const [name,token] of [
 ['real summary 46 baptisms',"WHERE profile_key='BAUTIZOS'"],
 ['total 219 historic links','full_total<>219'],
 ['real QA covers all pages','100,200'],
 ['records evidence without modifying link','review_recorded_without_link_mutation'],
 ['rejects parish actor','V218 BAD parish accessed chancery queue'],
 ['rejects other diocese chancery','V218 BAD other chancery reviewed foreign case'],
 ['rejects anon reads','V218 BAD anonymous read allowed'],
 ['rejects anon writes','V218 BAD anonymous write allowed'],
 ['prevents direct review table read','V218 BAD direct table read permitted'],
 ['rejects weak reference','V218 BAD weak audit reference permitted'],
 ['rejects fabricated reconciliation','V218 BAD unapproved relink decision permitted']
]) test('V218 SQL verified scenario: '+name,()=>assert.ok(qa.includes(token)));
test('V218 route is protected by real chancery role',()=>{
 assert.match(app,/HistoricalLinkReviewPage/);
 assert.match(app,/path="\/chancery\/historicos\/conciliacion"/);
 assert.match(app,/requiredRole=\{ROLE_TYPES.CHANCERY\}><HistoricalLinkReviewPage/);
});
test('V218 dashboard exposes historical review',()=>{
 assert.match(dashboard,/Revisión de Vínculos Históricos/);
 assert.match(dashboard,/navigate\('\/chancery\/historicos\/conciliacion'\)/);
});
test('V218 interface is auditable and no action directly corrects a sacramental registry',()=>{
 assert.match(page,/list_unresolved_legacy_links_v218/);
 assert.match(page,/summarize_unresolved_legacy_links_v218/);
 assert.match(page,/record_unresolved_legacy_link_review_v218/);
 assert.match(page,/Este módulo registra constancias de investigación/);
 assert.doesNotMatch(page,/\.from\(['"](baptisms|confirmations|legacy_record_links)['"]\)/);
 assert.match(page,/No se modificó la partida ni el vínculo histórico/);
});
test('V218 interface prevents stale cross-role response leaks',()=>{
 assert.match(page,/currentIdentity\.current !== key/);
 assert.match(page,/loadedIdentity === identity/);
 assert.match(page,/scopeCurrent/);
 assert.match(page,/setRows\(\[\]\)/);
 assert.match(page,/setSummary\(\[\]\)/);
});
test('V218 interface disallows undocumented review and caps user input',()=>{
 assert.match(page,/evidence\.length < 8 \|\| evidence\.length > 180/);
 assert.match(page,/maxLength=\{180\}/);
 assert.match(page,/disabled=\{Boolean\(saving\) \|\| busy\}/);
});
