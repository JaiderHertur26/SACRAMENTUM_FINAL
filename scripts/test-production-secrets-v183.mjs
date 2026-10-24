import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseEnv,scanBuild,jwtPrivilegeMarkers} from './audit-production-secrets-v183.mjs';

function fixture(bundle, env='',tracked=[]) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-secrets-'));
  try {
    const build=path.join(dir,'dist');fs.mkdirSync(build);
    fs.writeFileSync(path.join(build,'bundle.js'),bundle);
    if (env) fs.writeFileSync(path.join(dir,'.env.local'),env);
    return scanBuild({buildDir:build,envFiles:[path.join(dir,'.env.local')],trackedFiles:tracked});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('V183 public anon credentials are not privileged tokens',()=>{
  const res=fixture('const anon="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signaturesignaturesignature";');
  assert.equal(res.passed,true);
});
test('V183 private variable values cannot appear in browser build',()=>{
  const s='synthetic-privileged-value-111111111111';
  const res=fixture('const x="'+s+'";','SUPABASE_SERVICE_ROLE_KEY='+s);
  assert.equal(res.passed,false);assert.equal(res.violations[0].code,'private-env-value-embedded');
});
test('V183 public variable names cannot contain privileged terms',()=>{
  const res=fixture('safe','VITE_SUPABASE_SERVICE_ROLE_KEY=neverdo');
  assert.equal(res.passed,false);
  assert.equal(res.violations[0].code,'public-privileged-env-name');
});
test('V183 special prefix is always rejected',()=>{
  assert.equal(fixture('const secret="sb_secret_12345678901234567890";').passed,false);
});
test('V183 .env tracked by git is always rejected',()=>{
  assert.equal(fixture('safe','', ['.env.production']).passed,false);
});
test('V183 JWT payload service_role is rejected without printing its content',()=>{
  const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.aaaaaaaaaaaaaaaaaaaa';
  assert.deepEqual(jwtPrivilegeMarkers(token),['privileged-jwt']);
  assert.equal(fixture('const token="'+token+'";').passed,false);
});
test('V183 private key marker is rejected',()=>{
  assert.equal(fixture('const x="-----BEGIN PRIVATE KEY-----";').passed,false);
});
test('V183 env parser accepts quotations and avoids comments',()=>{
  assert.deepEqual(parseEnv('A="abc"\n# B=wrong\nC= z'),[{name:'A',value:'abc'},{name:'C',value:'z'}]);
});
