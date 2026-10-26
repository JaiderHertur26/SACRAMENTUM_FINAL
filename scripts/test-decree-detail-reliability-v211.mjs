import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const page=fs.readFileSync('src/pages/parish/ParishDecreeDetailPage.jsx','utf8');
const harness=fs.readFileSync('scripts/audit-document-details-browser-v211.mjs','utf8');
const mock=fs.readFileSync('scripts/qa-v211-details/mockSupabase.js','utf8');
const aliases=fs.readFileSync('scripts/qa-v211-details/vite.config.mjs','utf8');
test('V211 decree query always resolves loading on success or exception',()=>{
 assert.match(page,/try \{[\s\S]*?\.maybeSingle\(\)/);
 assert.match(page,/catch \{[\s\S]*?setLoadError\(/);
 assert.match(page,/finally \{\s*if \(active\) \{\s*setLoadedKey\(detailKey\);\s*setLoading\(false\)/);
});
test('V211 request errors never disclose internal provider details',()=>{
 assert.match(page,/description: 'La consulta no se completó\. Puede volver a intentarlo\.'/);
 assert.doesNotMatch(page,/description:\s*error\.message/);
 assert.match(page,/role=\{loadError \? 'alert' : undefined\}/);
});
test('V211 retry is explicit and tied to effect dependencies',()=>{
 assert.match(page,/setRetryCount\(\(value\) => value \+ 1\)/);
 assert.match(page,/\[decreeId, parishId, retryCount\]/);
});
test('V211 decree trace is supplementary, asynchronously loaded',()=>{
 assert.match(page,/setDecree\(data \|\| null\);\s*setAuditInfo\(null\)/);
 assert.match(page,/void \(async \(\) => \{/);
 assert.match(page,/if \(!active \|\| auditError\) return/);
});
test('V211 decree identity, parish scope and cancellation preserved',()=>{
 assert.match(page,/\.eq\('id', decreeId\)/);
 assert.match(page,/\.eq\('parish_id', parishId\)/);
 assert.match(page,/return \(\) => \{ active = false; \}/);
 assert.match(page,/loadedKey === detailKey \? loadedDecree : null/);
});
test('V211 isolated browser fixture never includes live SDK credentials',()=>{
 assert.match(aliases,/mockSupabase\.js/);
 assert.match(aliases,/mockAuth\.jsx/);
 assert.doesNotMatch(mock,/https:\/\//);
 assert.doesNotMatch(mock,/createClient\(/);
 assert.match(harness,/zero credentials|No Supabase credentials/i);
});
test('V211 browser probes positive and negative paths',()=>{
 for(const key of ['decree_current_view','decree_document_print','decree_historical_view','decree_foreign_denied','decree_network_error_not_stuck','decree_retry_recovers','decree_trace_rpc_never_resolves_but_document_opens','decree_stale_response_isolation','decree_cross_parish_scope_change','baptism_scope_positive','baptism_modal_preview','baptism_foreign_denied','baptism_stale_response_isolation'])assert.ok(harness.includes(key),key);
});
