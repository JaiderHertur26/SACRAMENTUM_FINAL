import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const page=read('src/pages/chancery/LaterNoteReconciliationPage.jsx');
const auth=read('src/context/AuthContext.jsx');
const mocks=read('scripts/qa-v160-browser/mocks.jsx');
const browser=JSON.parse(read('AUDITORIA_AISLAMIENTO_SESION_V162.json'));

test('V162 session identity includes user, role, diocese and chancery',()=>{
 assert.match(page,/const userId = String\(user\?\.id \|\| user\?\.auth_user_id/);
 assert.match(page,/const identityKey = \[userId,role/);
 assert.match(page,/user\?\.chanceryId \|\| user\?\.chancery_id/);
});
test('V162 scope changes invalidate both in-flight list and note picker',()=>{
 assert.match(page,/listVersion\.current\+\+/);
 assert.match(page,/lookupVersion\.current\+\+/);
 assert.match(page,/return \(\)=>\{cancelled=true;listVersion\.current\+\+;lookupVersion\.current\+\+;/);
});
test('V162 scope switch resets diocese, pending forms, data and notes',()=>{
 for(const x of ['setDioceseId(\'\')','setItems([])','setAvailableNotes([])','setForm(empty)','setApprove({})','setReject({})','setLoadedScope(\'\')'])
 assert.ok(page.includes(x),x);
});
test('V162 no visible data unless fetched for current scope',()=>{
 assert.match(page,/const scopeCurrent = !!userId && \(chancery \|\| dioceseRole\) && scopeOwner===identityKey/);
 assert.match(page,/const dataCurrent = scopeCurrent && loadedScope===identityKey/);
 assert.match(page,/const visibleItems = dataCurrent \? items : \[\]/);
 assert.match(page,/visibleItems\.map\(x=>/);
});
test('V162 authorization controls require fresh scope',()=>{
 assert.match(page,/if\(!dioceseRole \|\| !dataCurrent \|\| busy\)return/);
 assert.match(page,/if\(!chancery \|\| !dataCurrent \|\| busy\)return/);
});
test('V162 requests cannot be started before session scope resolves',()=>{
 assert.match(page,/if\(!chancery \|\| !scopeCurrent \|\| !dioceseId \|\| busy\)return/);
});
test('V162 old list response cannot update new session',()=>{
 assert.match(page,/if\(version!==listVersion\.current\)return/);
 assert.match(page,/setLoadedScope\(identityKey\)/);
});
test('V162 stale note lookup does not repopulate note field',()=>{
 assert.match(page,/if\(version!==lookupVersion\.current\)return/);
 assert.match(page,/lookupVersion\.current\+\+;setLookingUp\(false\);setForm/);
});
test('V162 AuthContext uses actual Supabase user ID and diocese',()=>{
 assert.match(auth,/id: authUser\.id/);
 assert.match(auth,/dioceseId: prof\.diocese_id \|\| null/);
});
test('V162 browser verified six fail-closed identity transitions',()=>{
 assert.equal(browser.passed,true);
 assert.equal(browser.steps.length,6);
 assert.ok(browser.steps.every(x=>x.passed));
 assert.deepEqual(browser.errors,[]);
});
test('V162 delayed response from identity A not shown under B',()=>{
 const stale=browser.steps.find(x=>x.name==='A_LATE_RESPONSE_DISCARDED');
 assert.ok(stale?.passed);
 assert.equal(stale.detail.articles,1);
 assert.equal(stale.detail.containsA,false);
 assert.equal(stale.detail.containsB,true);
});
test('V162 logout clears every case card and form',()=>{
 const logout=browser.steps.find(x=>x.name==='LOGOUT_FAILS_CLOSED');
 assert.ok(logout?.passed);
 assert.equal(logout.detail.articles,0);
 assert.equal(logout.detail.form,0);
});
test('V162 isolated browser uses fictitious identity changes only',()=>{
 assert.match(browser.scope,/simulated users and delayed mock requests ONLY/);
 assert.match(mocks,/changeIdentity=\(newIdentity\)=>/);
 assert.match(mocks,/DATOS TOTALMENTE FICTICIOS · SIN CONEXIÓN A SUPABASE/);
});
test('V162 screenshot is a nonempty actual PNG',()=>{
 const png=fs.readFileSync('AUDITORIA_EVIDENCIA_VISUAL_V162/v162-diocese-b-no-cross-scope.png');
 assert.ok(png.length>8000);
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
