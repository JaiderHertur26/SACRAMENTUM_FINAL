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
// V175 is a historical Chrome snapshot of 107 paths. New protected routes must
// not invalidate the old evidence or be falsely claimed as visually certified by it.
const auditedPaths=new Set(local.results.map(x=>x.path));
test('V175 historical 107-route audit remains intact and new routes are protected',()=>{
 assert.equal(auditedPaths.size,107);
 assert.ok(routes.length>=107);
 assert.equal(new Set(routes.map(x=>x.path)).size,routes.length);
 assert.ok(routes.every(x=>x.guarded||x.redirect));
 const currentPaths=new Set(routes.map(x=>x.path));
 for(const p of auditedPaths)assert.ok(currentPaths.has(p),'Previously audited route disappeared: '+p);
 const newChancery=routes.find(x=>x.path==='/chancery/historicos/conciliacion');
 assert.ok(newChancery?.guarded,'V218 route must be protected even though not in V175 Chrome report');
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
  assert.deepEqual(new Set(report.results.map(x=>x.path)),auditedPaths);
  // Only these 107 paths were visually tested in V175; never claim later routes were.
  assert.ok(routes.length>=report.results.length);
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
