import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023203219_fail_closed_institutional_identity_v176.sql','utf8');
const repro=fs.readFileSync('scripts/qa-rollback-undefined-profile-role-repro-v176.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-institutional-identity-v176.sql','utf8');
const names=['current_app_role','current_app_diocese_id','current_app_parish_id','current_app_chancery_id','current_chat_profile_id','can_access_chat_room','current_effective_diocese_id'];
for(const name of names)test('V176 protects '+name+' privileged helper',()=>{assert.ok(migration.includes('public.'+name+'('),name)});
test('V176 enforces explicit active boolean and strictly ACTIVE status',()=>{
 assert.match(migration,/is_active IS TRUE/);assert.match(migration,/strict_state:='upper\(status\)=''ACTIVE'''/);assert.match(migration,/strict_state:='upper\('/);assert.match(migration,/active_new:='up\.is_active IS TRUE and upper\(up\.status\)=''ACTIVE'''/);
});
test('V176 effective diocese requires active status in all 3 branches',()=>{
 assert.match(migration,/item\.alias_name='effective'/);assert.match(migration,/instances<>3/);
 assert.match(migration,/up\.is_active IS TRUE and upper\(up\.status\)=''ACTIVE''/);
});
test('V176 aborts incompatible SQL definitions rather than rewriting unrecognized functions',()=>{
 assert.match(migration,/position\('SECURITY DEFINER' IN original\)=0/);
 assert.match(migration,/identity predicates absent\/changed/);
 assert.match(migration,/identity function changed or missing/);
});
test('V176 does not mutate records or change function grants',()=>{
 assert.doesNotMatch(migration,/\bTRUNCATE\b|\bDROP TABLE\b|\bUPDATE\s+public\.|\bDELETE FROM\b|\bGRANT\s+|\bREVOKE\s+|\bALTER TABLE\b/i);
 assert.match(migration,/pg_get_functiondef/);assert.match(migration,/EXECUTE changed/);
});
test('V176 prepatch demonstrated SUSPENDED effective diocese and NULL status role',()=>{
 assert.match(repro,/V176_PREPATCH_SUSPENDED_EFFECTIVE_DIOCESE_CONFIRMED/);
 assert.match(repro,/V176_PREPATCH_NULL_STATUS_GRANTED_ROLE_CONFIRMED/);
 assert.match(repro,/VALUES\(actor,'parish',p,di,'SUSPENDED',true\)/);
});
test('V176 SQL QA verifies legitimate parish identity before forbidden cases',()=>{
 assert.match(qa,/legitimate active parish lost authorized scope/);
 for(const fn of ['current_app_role','current_app_parish_id','current_app_diocese_id','current_effective_diocese_id','current_chat_profile_id'])assert.ok(qa.includes(fn));
});
test('V176 four invalid states must all yield NULL scope from six helpers',()=>{
 for(const state of ['SUSPENDED','NULL_STATUS','NULL_ACTIVE','DISABLED'])assert.ok(qa.includes("'"+state+"'"),state);
 assert.match(qa,/forbidden institutional scope for/);
});
test('V176 all real database QA files create only synthetic users and roll back',()=>{
 for(const sql of [repro,qa]){assert.match(sql,/^BEGIN;$/m);assert.match(sql,/ROLLBACK;\s*$/);assert.match(sql,/@example\.invalid/);assert.doesNotMatch(sql,/^\s*COMMIT\s*;/mi);}
});

test('V176 frontend validates explicit active state, matching PostgreSQL institutional identity',async()=>{
 const source=fs.readFileSync('src/lib/authz.js','utf8');
 const isolated=source.replace(/^import \{ ROLE_TYPES \} from .*;$/m,
  "const ROLE_TYPES={ADMIN_GENERAL:'admin_general',DIOCESE:'diocese',CHANCERY:'chancery',PARISH:'parish'};");
 const {validateProfileScope}=await import('data:text/javascript,'+encodeURIComponent(isolated));
 const profile={role:'parish',parish_id:'parish-fixture',diocese_id:'diocese-fixture',is_active:true,status:'ACTIVE'};
 assert.equal(validateProfileScope(profile).valid,true);
 for(const invalid of [
  {...profile,status:'SUSPENDED'},
  {...profile,status:null},
  {...profile,status:undefined},
  {...profile,status:''},
  {...profile,is_active:null},
  {...profile,is_active:undefined},
  {...profile,is_active:false}
 ])assert.equal(validateProfileScope(invalid).valid,false,JSON.stringify(invalid));
 assert.equal(validateProfileScope({...profile,status:'active'}).valid,true);
});
