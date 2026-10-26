// V175: static regression contract against timestamped, real Chrome & HTTPS evidence.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const local=JSON.parse(fs.readFileSync('AUDITORIA_RUTAS_ANONIMAS_V175.json','utf8'));
const prod=JSON.parse(fs.readFileSync('AUDITORIA_RUTAS_PRODUCCION_V175.json','utf8'));
const api=JSON.parse(fs.readFileSync('AUDITORIA_DATA_API_ANONIMA_V175.json','utf8'));
const src=fs.readFileSync('src/App.jsx','utf8');
const routes=src.split(/(?=<Route\b)/).slice(1).map(c=>({
 path:c.match(/^\s*<Route\s+[\s\S]*?\bpath="([^"]+)"/)?.[1],
 guarded:/\belement\s*=\s*\{\s*<ProtectedRoute\b/.test(c.slice(0,550)),
 redirect:/\belement\s*=\s*\{\s*<Navigate\b/.test(c.slice(0,550))
})).filter(x=>x.path&&!['/','/login','/404','*','/account-configuration-error','/reset-password'].includes(x.path));
test('V175 finds 107 restricted or alias routes in the current router, all with guards or redirects',()=>{
 assert.equal(routes.length,107);assert.equal(new Set(routes.map(x=>x.path)).size,107);
 assert.ok(routes.every(x=>x.guarded||x.redirect));
 assert.equal(routes.filter(x=>x.guarded).length,58);
 assert.equal(routes.filter(x=>x.redirect).length,49);
});
for(const [label,report] of [['local',local],['production',prod]]){
 test('V175 '+label+' Chrome inspected every route with no unauthorized content',()=>{
  assert.equal(report.sourceRouteCount,107);assert.equal(report.guarded,58);assert.equal(report.aliases,49);
  assert.equal(report.passed,107);assert.equal(report.failed,0);
  assert.equal(report.results.length,107);assert.equal(report.exceptions.length,0);
  for(const r of report.results){
   assert.ok(r.passed,r.path);assert.equal(r.redirected,true,r.path);
   assert.equal(r.loginVisible,true,r.path);assert.equal(r.horizontalOverflow,false,r.path);
   assert.equal(r.errors,0,r.path);
  }
  assert.deepEqual(new Set(report.results.map(x=>x.path)),new Set(routes.map(x=>x.path)));
 });
}
test('V175 real production HTTPS was tested rather than a mock host',()=>{
 assert.equal(prod.base,'https://sacramentum-final.vercel.app');
 assert.equal(prod.environment,'vercel-production');
 assert.equal(local.environment,undefined);
 assert.ok(local.method.includes('Vite'));
});
test('V175 real anonymous REST requests did not return private rows',()=>{
 assert.equal(api.checks,15);assert.equal(api.privateRowsSeen,0);assert.equal(api.unverified,0);
 assert.equal(api.results.length,15);
 for(const r of api.results){
  assert.ok([200,401,403].includes(r.status),r.table);
  if(r.status===200)assert.equal(r.returnedRows,0,r.table);
  else assert.equal(r.errorCode,'42501',r.table);
  assert.equal(r.gatewayKeyError,false,r.table);
  assert.equal(r.privateExposed,false,r.table);
 }
});
test('V175 confidential authentication credentials were not stored in the audit report',()=>{
 const raw=JSON.stringify({local,prod,api});
 assert.doesNotMatch(raw,/"access_token"|"refresh_token"|"apikey":"|Bearer eyJ/i);
 assert.ok(api.results.every(x=>!Object.hasOwn(x,'rows')));
});
test('V175 public tests are not misrepresented as authentic multi-diocese E2E',()=>{
 assert.match(prod.scope,/No real user session/i);
 assert.match(api.method,/anonymous role/i);
});
