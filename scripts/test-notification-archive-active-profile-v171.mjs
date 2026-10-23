// V171 · Contract tests: archived matrimonial notifications must require an ACTIVE parish account.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023175641_archive_notification_active_profile_v171.sql','utf8');
const pre=fs.readFileSync('scripts/qa-rollback-notification-archive-status-repro-v171.sql','utf8');
const post=fs.readFileSync('scripts/qa-rollback-notification-archive-active-profile-v171.sql','utf8');
test('V171 hardens precisely one preexisting archive SECURITY DEFINER RPC',()=>{
 assert.match(migration,/pg_get_functiondef\('public\.archive_matrimonial_notification_recipient\(uuid\)'::regprocedure\)/);
 assert.match(migration,/upper\(coalesce\(up\.status,'ACTIVE'\)\)='ACTIVE'/);
 assert.match(migration,/coalesce\(up\.is_active,true\)=true/);
 assert.doesNotMatch(migration,/DROP FUNCTION|DROP TABLE|ALTER TABLE|DELETE FROM/i);
});
test('V171 migration fails closed against version drift or duplicate patch',()=>{
 assert.match(migration,/position\(v_old IN v_src\)=0/);
 assert.match(migration,/position\('upper\(coalesce\(up\.status,' IN v_src\)>0/);
 assert.match(migration,/RAISE EXCEPTION 'V171 archivador incompatible/);
});
test('V171 does not alter grants, other RPCs or existing actual records',()=>{
 assert.doesNotMatch(migration,/\bGRANT\b|\bREVOKE\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
 assert.match(migration,/EXECUTE replace\(v_src,v_old,v_new\)/);
});
test('V171 reproduced suspended actor bypass against real PostgreSQL before patch',()=>{
 assert.match(pre,/status='SUSPENDED',is_active=true/);
 assert.match(pre,/archive_matrimonial_notification_recipient\(v_recipient\)/);
 assert.match(pre,/V171_PREPATCH_CONFIRMED/);
});
test('V171 both QA SQL scripts use only reversible transactions with fake identifiers',()=>{
 for(const src of [pre,post]){
  assert.match(src,/^BEGIN;$/m);
  assert.match(src,/ROLLBACK;\s*$/);
  assert.doesNotMatch(src,/^\s*COMMIT\b/im);
  assert.match(src,/@example\.invalid/);
 }
});
test('V171 postpatch demands explicit institutional denial, not an arbitrary error',()=>{
 assert.match(post,/Suspended profile archived notice/);
 assert.match(post,/v_message <> 'Cuenta parroquial no autorizada'/);
 assert.match(post,/status FROM public\.matrimonial_notification_recipients WHERE id=r\)<>'pending'/);
});
test('V171 postpatch preserves authorized archival and idempotent repeat',()=>{
 assert.equal((post.match(/archive_matrimonial_notification_recipient\(r\)/g)||[]).length,3);
 assert.match(post,/status='ACTIVE'/);
 assert.match(post,/expected one archival audit event/);
});
test('V171 tests authenticated role, fake JWT and no real account update',()=>{
 assert.match(post,/SET LOCAL ROLE authenticated/);
 assert.match(post,/request\.jwt\.claim\.sub/);
 assert.match(post,/auth\.users\(id,instance_id,aud,role,email,created_at,updated_at\)/);
 assert.match(post,/WHERE auth_user_id=a/);
});
