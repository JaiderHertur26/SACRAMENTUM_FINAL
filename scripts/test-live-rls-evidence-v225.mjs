import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const report=JSON.parse(fs.readFileSync('AUDITORIA_RLS_IDENTIDADES_LIVE_V225.json','utf8'));
const sql=fs.readFileSync('scripts/qa-role-matrix-readonly-v225.sql','utf8');
const roles=['admin_general','diocese','chancery','parish'];
const tables=['baptisms','confirmations','marriages','funerals','pending_baptisms',
 'pending_confirmations','pending_marriages','pending_funerals','decretos',
 'marginal_notes','official_notifications','legacy_archive_records','document_issuances'];

test('V225 genuine database snapshot documents full scoped authenticated QA role matrix',()=>{
 assert.equal(report.protocol,'V225');
 assert.equal(report.projectRef,'foczofcmwampjvlfbsqn');
 assert.match(report.source,/READ ONLY/);
 assert.equal(report.scenarios,12);
 assert.equal(report.countsVerified,12);
 assert.equal(report.matrixQueries,156);
 assert.deepEqual(report.columnsTested,tables);
 assert.deepEqual(report.inconsistent,[]);
 assert.equal(report.productionReady,false);
});
for(const role of roles)test('V225 authenticated SQL RLS exercised for role: '+role,()=>{
 assert.ok(report.scenariosByRole.some(x=>x.role===role));
 for(const principal of report.scenariosByRole.filter(x=>x.role===role)){
  assert.equal(principal.jwtBound,true);
  assert.equal(principal.appRole,role);
  assert.equal(principal.error,undefined);
  assert.deepEqual(principal.mismatch,{});
 }
});
test('V225 interdiocesan helper categorically denies all ordinary roles',()=>{
 const others=report.scenariosByRole.filter(x=>x.role!=='admin_general');
 assert.ok(others.length>=9);
 for(const x of others){
  assert.equal(x.otherDioceseAccess,false,'diocese boundary for '+x.principal);
  assert.equal(x.otherDioceseParish,false,'parish boundary for '+x.principal);
 }
});
test('V225 general administrator is distinguished from institutional roles',()=>{
 const root=report.scenariosByRole.filter(x=>x.role==='admin_general');
 assert.equal(root.length,2);
 for(const x of root) {
  assert.equal(x.otherDioceseAccess,true);
  assert.equal(x.otherDioceseParish,true);
 }
});
test('V225 parish visibility and historical orphan scope is acknowledged rather than hidden',()=>{
 const parish=report.scenariosByRole.filter(x=>x.role==='parish');
 assert.equal(parish.length,5);
 assert.ok(parish.every(x=>!x.allowedDiocesanUnassignedArchiveRows));
 const diocesan=report.scenariosByRole.filter(x=>x.allowedDiocesanUnassignedArchiveRows===1552);
 assert.equal(diocesan.length,2);
 assert.ok(diocesan.every(x=>['chancery','diocese'].includes(x.role)));
 assert.match(report.ruleForDiocesanArchive,/1,552/);
});
test('V225 positive fixture has four sacramental records and multiple trial attachments',()=>{
 assert.equal(report.totalCounts.baptisms,5040);
 assert.equal(report.totalCounts.confirmations,2091);
 assert.equal(report.totalCounts.marriages,1261);
 assert.equal(report.totalCounts.funerals,1);
 assert.equal(report.totalCounts.legacy_archive_records,21676);
});
test('V225 registry audit journal stays inaccessible by direct SELECT to ordinary authenticated roles',()=>{
 assert.match(report.explicitGrants.registry_audit_log,/denied/);
 assert.match(sql,/has_table_privilege\('authenticated','public\.registry_audit_log','SELECT'\)/);
 assert.doesNotMatch(sql,/FROM public\.registry_audit_log/);
});
test('V225 SQL is explicitly READ ONLY, impersonates just a fictitious QA JWT, always rolls back',()=>{
 assert.match(sql,/BEGIN READ ONLY;/);
 assert.match(sql,/SET LOCAL ROLE authenticated;/);
 assert.match(sql,/set_config\('request\.jwt\.claim\.sub', '__FICTITIOUS_AUTH_USER_UUID__', true\)/);
 assert.match(sql,/ROLLBACK;/);
 const executable=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(executable,/^\s*(?:COMMIT|UPDATE|INSERT|DELETE|TRUNCATE|DROP|ALTER|GRANT|REVOKE|CREATE|DO|COPY|EXECUTE)\b/gim);
 assert.equal((executable.match(/\(SELECT count\(\*\) FROM public\./g)||[]).length,13);
});
test('V225 no real account IDs or sacramental subjects appear in committed SQL template',()=>{
 assert.doesNotMatch(sql,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 const source=JSON.stringify(report);
 assert.doesNotMatch(source,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
test('V225 SQL matrix is registered as regression in both CI and local master gate',()=>{
 const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 const gate=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 for(const s of [workflow,gate])assert.match(s,/scripts\/test-live-rls-evidence-v225\.mjs/);
});

const rpc=JSON.parse(fs.readFileSync('AUDITORIA_RPC_DELEGACION_LIVE_V225.json','utf8'));
test('V225 SQL identifies exactly 17 delegated privileged wrappers without direct identity text',()=>{
 assert.equal(rpc.protocol,'V225');
 assert.equal(rpc.reviewedRpcHints,17);
 assert.equal(rpc.snapshots.length,17);
 assert.equal(rpc.securityDefinersExposedToAuthenticated,152);
 assert.equal(new Set(rpc.snapshots.map(x=>x.rpc)).size,17);
 assert.ok(rpc.snapshots.every(x=>x.delegationPresent && x.delegatedCheck));
 assert.ok(rpc.snapshots.every(x=>/^[0-9a-f]{32}$/.test(x.definitionMd5)));
});
test('V225 privileged decree and historical baptism wrappers delegate to scoped guards',()=>{
 for(const name of ['apply_baptism_correction','apply_baptism_replacement','apply_confirmation_correction',
  'apply_confirmation_replacement','reverse_correction_decree_with_reason','reverse_replacement_decree_with_reason']) {
  assert.equal(rpc.snapshots.find(x=>x.rpc===name)?.delegatedCheck,'sacramentum_assert_chancery_for_parish');
 }
 assert.equal(rpc.snapshots.find(x=>x.rpc==='register_historical_baptism')?.delegatedCheck,'register_historical_baptism_internal');
 assert.match(rpc.downstreamGuardVerified,/EXECUTE revoked/);
});
test('V225 chat and matrimonial RPCs delegate to known membership/jurisdiction guards',()=>{
 for(const name of ['get_chat_room_messages','get_chat_room_messages_v166','mark_chat_room_read','send_chat_message','withdraw_chat_message'])
  assert.equal(rpc.snapshots.find(x=>x.rpc===name)?.delegatedCheck,'can_access_chat_room');
 for(const name of ['can_read_matrimonial_notification','can_read_matrimonial_recipient'])
  assert.equal(rpc.snapshots.find(x=>x.rpc===name)?.delegatedCheck,'current_app_role');
});
test('V225 delegated-check scan is explicitly not mistaken for full audit of 152 privileged RPCs',()=>{
 assert.ok(rpc.reviewedRpcHints<rpc.securityDefinersExposedToAuthenticated);
 assert.match(rpc.method,/Does not prove/);
 assert.match(rpc.remaining,/all 152/);
 assert.doesNotMatch(JSON.stringify(rpc),/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});

test('V225 authenticated JWT without an ACTIVE institutional profile sees no sacramental content',()=>{
 const missing=JSON.parse(fs.readFileSync('AUDITORIA_PERFIL_INEXISTENTE_LIVE_V225.json','utf8'));
 assert.equal(missing.qaOnly,true);
 assert.equal(missing.totalTables,13);
 assert.equal(missing.allZero,true);
 assert.equal(missing.scopeRole,null);
 assert.equal(missing.parishAccess,false);
 assert.equal(missing.writeOperations,0);
 assert.ok(Object.values(missing.tableCounts).every(n=>n===0));
});
