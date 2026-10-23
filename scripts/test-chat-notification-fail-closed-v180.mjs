import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023223152_strict_chat_notification_profile_v180.sql','utf8');
const repro=fs.readFileSync('scripts/qa-rollback-chat-null-status-repro-v180.sql','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-chat-notification-status-v180.sql','utf8');
const targets=[
 'archive_matrimonial_notification_recipient',
 'cancel_matrimonial_notification',
 'ensure_diocesan_chat_defaults',
 'issue_document_from_template',
 'issue_matrimonial_notification',
 'list_chat_directory',
 'list_my_chat_rooms',
 'mark_sacramental_notification_read',
 'mark_sacramental_receipt_read',
 'process_manual_matrimonial_notification_physical'
];
for(const name of targets){
 test('V180 protects required privileged RPC '+name,()=>assert.ok(migration.includes("'public."+name+"(")));
 test('V180 real matrix exercises '+name+' or its exact expected message',()=>{
  if(name==='list_chat_directory')assert.match(qa,/public\.list_chat_directory\(\)/);
  else if(name==='list_my_chat_rooms')assert.match(qa,/public\.list_my_chat_rooms\(\)/);
  else if(name==='ensure_diocesan_chat_defaults')assert.match(qa,/public\.ensure_diocesan_chat_defaults\(\)/);
  else assert.ok(qa.includes('public.'+name+'('),name);
 });
}
test('V180 strict is_active and strict status predicates replace implicit ACTIVE defaults',()=>{
 assert.match(migration,/is_active IS TRUE/);
 assert.match(migration,/up\.is_active IS TRUE/);
 assert.match(migration,/upper\(status\)=''ACTIVE''/);
 assert.match(migration,/upper\(up\.status\)=''ACTIVE''/);
});
test('V180 distinguishes plain profile, aliased profile, and document special case',()=>{
 assert.match(migration,/is_unqualified:=signature IN/);
 assert.match(migration,/doc_special:=signature LIKE/);
 assert.match(migration,/ELSIF doc_special THEN/);
});
test('V180 aborts on unexpected signature, grant intent or predicate definitions',()=>{
 assert.match(migration,/to_regprocedure\(signature\)/);
 assert.match(migration,/position\('SECURITY DEFINER' IN src\)=0/);
 assert.match(migration,/regexp_count\(src,active_pattern,1,'i'\)<>1/);
 assert.match(migration,/regexp_count\(src,status_pattern,1,'i'\)<>1/);
 assert.match(migration,/changed<>10/);
});
test('V180 patch only replaces privileged function predicates',()=>{
 assert.match(migration,/pg_get_functiondef\(fn\)/);
 assert.match(migration,/EXECUTE patched/);
 assert.doesNotMatch(migration,/\bDROP\s+(?:TABLE|FUNCTION)\b|\bTRUNCATE\b|\bALTER TABLE\b|\bGRANT\b|\bREVOKE\b|\bUPDATE\s+public\.|\bINSERT INTO\s+public\./i);
});
test('V180 real prepatch evidence confirms directory leakage under null profile status',()=>{
 assert.match(repro,/current_app_role\(\) IS NOT NULL/);
 assert.match(repro,/jsonb_array_length\(directory\)/);
 assert.match(repro,/V180_PREPATCH_NULL_STATUS_CHAT_DIRECTORY_EXPOSED_COUNT_/);
 assert.match(repro,/only_error_summary|exposed_contact_count_only/);
});
test('V180 six invalid scenarios are tested across all ten privileged functions',()=>{
 for(const s of ['NULL_STATUS','NULL_ACTIVE','SUSPENDED','DISABLED','PENDING','BLANK_STATUS'])
  assert.ok(qa.includes("'"+s+"'"),s);
 assert.match(qa,/active<>10 OR blocked<>60/);
});
test('V180 testing compares named denials, not arbitrary database errors',()=>{
 assert.match(qa,/got IS DISTINCT FROM expected/);
 assert.match(qa,/Perfil activo no disponible/);
 assert.match(qa,/Perfil institucional no autorizado para Chat Diocesano/);
 assert.match(qa,/Cuenta parroquial activa requerida/);
 assert.match(qa,/Sólo una cuenta parroquial activa puede emitir notificaciones matrimoniales/);
});
test('V180 real QA verifies chat data hidden when actor becomes unauthorized',()=>{
 assert.match(qa,/jsonb_typeof\(arr\)<>'array'/);
 assert.match(qa,/expected='EMPTY_ARRAY' AND jsonb_array_length\(arr\)<>0/);
 assert.match(qa,/dir_positive<1/);
});
test('V180 tests allow active actors without bypassing domain-level validation',()=>{
 assert.match(qa,/Plantilla no disponible para este ámbito/);
 assert.match(qa,/La fecha de matrimonio es obligatoria/);
 assert.match(qa,/La notificación no pertenece a esta parroquia/);
});
test('V180 both real SQL fixtures are fictional and transactionally reversible',()=>{
 for(const x of [qa,repro]){
  assert.match(x,/^BEGIN;$/m);
  assert.match(x,/ROLLBACK;\s*$/);
  assert.match(x,/@example\.invalid/);
  assert.doesNotMatch(x,/^\s*COMMIT\s*;/mi);
 }
});
test('V180 never serializes personal contact data in its report',()=>{
 assert.match(repro,/exposed_contact_count_only/);
 assert.match(qa,/only_aggregate_counts/);
 assert.doesNotMatch(qa,/RAISE NOTICE[^;]*email|SELECT\s+(email|full_name)\s+FROM/i);
});