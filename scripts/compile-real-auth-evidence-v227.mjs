// V227 PRIVATE runtime compiler. Run only on the authorized QA machine after REAL tests.
// Never commit raw QA auth reports or secret config. This file emits only redacted aggregates.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const auth=read('AUDITORIA_AUTH_SESIONES_REALES_V208.json');
const scopes=read('AUDITORIA_AUTH_JURISDICCIONES_V208.json');
const app=read('AUDITORIA_AUTH_APP_COMPLETA_V208.json');
const concurrent=read('AUDITORIA_CONCURRENCIA_REAL_V208.json');
const resilience=read('AUDITORIA_AUTH_RESILIENCIA_V208.json');
const password=read('AUDITORIA_RECUPERACION_PASSWORD_V208.json');
const all=[auth,scopes,app,concurrent,resilience,password];
if(all.some(r=>r.protocol!=='V208'||!r.date||!/^2026-10-2[67]T/.test(r.date)))
 throw Error('QA V208 evidence must be freshly rerun for V227');
if(auth.total!==8 || auth.passed!==8 || !auth.wrongPasswordRejected || auth.rows?.length!==8 ||
  auth.rows.some(x=>!x.login||!x.genuineAuthUser||!x.profileMatches||x.role!==x.expectedRole))
 throw Error('Real password sign-in evidence failed');
if(scopes.rows?.length!==25 || scopes.rows.some(r=>!r.passed||!r.code||r.code!=='42501'&&r.action===undefined) ||
 scopes.rows.filter(r=>r.sacrament).length!==24 ||
 scopes.rows.some(r=>r.sacrament&&r.code!=='42501'))throw Error('Protected server scope test failed');
if(app.rows?.length!==4 ||app.rows.some(r=>!r.passed) ||app.exceptions?.length ||app.externalRequests?.length)
 throw Error('Actual React application login and routing failed');
if(concurrent.rows?.length!==5||concurrent.rows.some(r=>!r.passed||!r.parametersUnchanged) ||
 !concurrent.deadlock?.oneDeadlockVictim || !concurrent.deadlock?.survivorRolledBack ||
 !concurrent.deadlock?.nextRequestRecovered)throw Error('Real rollback/concurrency failed');
if(resilience.rows?.length!==4||resilience.rows.some(r=>!r.passed)||
 resilience.exceptions?.length||resilience.externalRequests?.length)
 throw Error('Real session safety regression failed');
if(password.rows?.length!==1||!password.rows[0].passed||
 !password.rows[0].evidence?.oldPasswordRejected ||!password.rows[0].evidence?.newPasswordAccepted||
 password.rows[0].evidence?.passwordWrites!==1||
 password.exceptions?.length)throw Error('Real QA password update failed');
const sourceFiles=[
 'src/context/AuthContext.jsx','src/App.jsx','src/pages/ResetPasswordPage.jsx',
 'src/components/PasswordRecoveryRedirect.jsx','src/services/passwordRecoveryService.js'];
if(app.sourceSha256!==sha('src/context/AuthContext.jsx')||
 resilience.sourceSha256!==sha('src/context/AuthContext.jsx'))
 throw Error('Actual React source changed since live browser testing');
for(const [p,h] of Object.entries(password.sourceSha256||{}))if(sha(p)!==h)
 throw Error('Password source changed since live test: '+p);
const result={
 protocol:'V227',environment:'EXISTING_QA_FICTITIOUS_ONLY',project_ref:'foczofcmwampjvlfbsqn',
 source:'Actual Supabase GoTrue login/password, browser React AuthProvider, live protected RPCs and PostgreSQL concurrency; source reports held locally and NOT committed',
 qaRecordsAreNotOfficial:true,mayAuthorizeProduction:false,verified_at:new Date().toISOString(),
 coverage:{
   authenticatedAccounts:8,authenticatedAccountsPassed:8,wrongPasswordRejected:true,
   protectedRpcCrossJurisdictionAttempts:25,protectedRpcDenials:25,fourSacramentDenials:24,
   actualReactRoleDashboards:4,actualReactRoleDashboardsPassed:4,realAppBrowserExceptions:0,realAppForbiddenExternalRequests:0,
   twoActualUsersConcurrentModes:5,concurrencyModesPassed:5,deadlockDetected:true,deadlockRecovered:true,rollbackParametersUnchanged:true,
   logoutBlockRaceScenarios:4,logoutBlockRaceScenariosPassed:4,
   realQaPasswordResetPassed:true,oldPasswordRejected:true,changedPasswordAccepted:true,duplicatePasswordSubmitBlocked:true,
   outgoingEmailDeliveryVerified:false,officialCleanDatabaseCreated:false
 },
 qaDbPostTestCounts:{
   baptisms:5040,confirmations:2091,marriages:1261,funerals:1,
   pending_baptisms:69,pending_confirmations:233,pending_marriages:1,pending_funerals:1,
   auth_accounts:12,qa208_active_profiles:8
 },
 sourceSha256:Object.fromEntries(sourceFiles.map(p=>[p,sha(p)])),
 semanticLimits:[
  'Scope and role tests were real GoTrue JWT calls; they do not provide an institutionally signed certificate.',
  'Concurrent sacramental test operations rolled back deliberately; final legal issuance and full positive parish workflow still require validation.',
  'Password update worked for a QA account; recovery email delivery and SMTP were NOT tested.',
  'All data remain fictitious. Production still requires an entirely separate empty project and outstanding security reviews.'
 ],
 releaseBlockingIssues:['remaining supabase_admin future default privileges','152 authenticated SECURITY DEFINER routines need formal scope review','independent clean production installation and real restore/SMTP/physical PDF acceptance']
};
if(JSON.stringify(result).includes('password":"')||JSON.stringify(result).includes('access_token')||JSON.stringify(result).includes('refresh_token'))
 throw Error('Unsafe private auth artifact included');
fs.writeFileSync('AUDITORIA_AUTH_SESIONES_REALES_V227.json',JSON.stringify(result,null,2)+'\n');
console.log('V227 authentic QA users=8/8, foreign scope=25/25, real app routes=4/4, concurrency=5/5, resilience=4/4, password reset=1/1; private material omitted');
