import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const evidence=JSON.parse(fs.readFileSync('AUDITORIA_AUTH_SESIONES_REALES_V227.json','utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const c=evidence.coverage;
test('V227 stores genuine GoTrue + React QA evidence without secrets',()=>{
 assert.equal(evidence.protocol,'V227');
 assert.equal(evidence.project_ref,'foczofcmwampjvlfbsqn');
 assert.equal(evidence.qaRecordsAreNotOfficial,true);
 assert.equal(evidence.mayAuthorizeProduction,false);
 assert.match(evidence.source,/Actual Supabase GoTrue/);
 assert.match(evidence.source,/NOT committed/);
 assert.ok(Number.isFinite(Date.parse(evidence.verified_at)));
});
test('V227 eight real password logins and a wrong password rejection',()=>{
 assert.equal(c.authenticatedAccounts,8);
 assert.equal(c.authenticatedAccountsPassed,8);
 assert.equal(c.wrongPasswordRejected,true);
});
test('V227 real protected RPCs refused twenty-four unauthorized sacramental writes',()=>{
 assert.equal(c.fourSacramentDenials,24);
 assert.equal(c.protectedRpcCrossJurisdictionAttempts,25);
 assert.equal(c.protectedRpcDenials,25);
});
test('V227 actual web application browser role login, refresh and route redirection',()=>{
 assert.equal(c.actualReactRoleDashboards,4);
 assert.equal(c.actualReactRoleDashboardsPassed,4);
 assert.equal(c.realAppBrowserExceptions,0);
 assert.equal(c.realAppForbiddenExternalRequests,0);
});
test('V227 two independently authenticated users executed five database concurrency scenarios',()=>{
 assert.equal(c.twoActualUsersConcurrentModes,5);
 assert.equal(c.concurrencyModesPassed,5);
 assert.equal(c.deadlockDetected,true);
 assert.equal(c.deadlockRecovered,true);
 assert.equal(c.rollbackParametersUnchanged,true);
});
test('V227 actual session logout, offline signout, suspension and stale auth protection',()=>{
 assert.equal(c.logoutBlockRaceScenarios,4);
 assert.equal(c.logoutBlockRaceScenariosPassed,4);
});
test('V227 actual QA password update rejects previous password and duplicated submits',()=>{
 assert.equal(c.realQaPasswordResetPassed,true);
 assert.equal(c.oldPasswordRejected,true);
 assert.equal(c.changedPasswordAccepted,true);
 assert.equal(c.duplicatePasswordSubmitBlocked,true);
});
test('V227 must never claim that real mail delivery or official new installation was verified',()=>{
 assert.equal(c.outgoingEmailDeliveryVerified,false);
 assert.equal(c.officialCleanDatabaseCreated,false);
 assert.ok(evidence.semanticLimits.some(x=>x.includes('SMTP')));
 assert.ok(evidence.releaseBlockingIssues.some(x=>x.includes('supabase_admin')));
 assert.ok(evidence.releaseBlockingIssues.some(x=>x.includes('152')));
});
test('V227 historical QA dataset remains marked fictitious',()=>{
 assert.equal(evidence.qaDbPostTestCounts.baptisms,5040);
 assert.equal(evidence.qaDbPostTestCounts.confirmations,2091);
 assert.equal(evidence.qaDbPostTestCounts.marriages,1261);
 assert.equal(evidence.qaDbPostTestCounts.funerals,1);
 assert.equal(evidence.qaDbPostTestCounts.auth_accounts,12);
 assert.equal(evidence.qaDbPostTestCounts.qa208_active_profiles,8);
});
test('V227 no private QA user identifiers, JWT or account passwords committed in evidence',()=>{
 const str=JSON.stringify(evidence);
 assert.doesNotMatch(str,/\b(access_token|refresh_token|encrypted_password|passwordHash|service_role_key|apiKey|email)\s*":/i);
 assert.doesNotMatch(str,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 assert.doesNotMatch(str,/qa208\.[a-z]+@/i);
});
test('V227 authenticated browser evidence becomes stale when core app or auth sources change',()=>{
 const files=[
 'src/context/AuthContext.jsx','src/App.jsx','src/pages/ResetPasswordPage.jsx',
 'src/components/PasswordRecoveryRedirect.jsx','src/services/passwordRecoveryService.js'
 ];
 assert.deepEqual(Object.keys(evidence.sourceSha256).sort(),files.sort());
 for(const file of files)assert.equal(evidence.sourceSha256[file],hash(file),'rerun genuine QA browser acceptance before shipping changed '+file);
});
test('V227 private config never ships to git or CI and live compiler remains manual',()=>{
 const workflow=fs.readFileSync('.github/workflows/sacramentum-auditoria-v90.yml','utf8');
 const master=fs.readFileSync('scripts/audit-gate-v90.mjs','utf8');
 const compiler=fs.readFileSync('scripts/compile-real-auth-evidence-v227.mjs','utf8');
 assert.match(workflow,/scripts\/test-real-auth-evidence-v227\.mjs/);
 assert.match(master,/scripts\/test-real-auth-evidence-v227\.mjs/);
 assert.doesNotMatch(workflow,/audit-live-auth-v208|compile-real-auth-evidence-v227/);
 assert.match(compiler,/sacramentum-qa208-private|raw QA auth reports|AUDITORIA_AUTH_SESIONES_REALES_V208/);
});
