import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('src/pages/chancery/LaterNoteReconciliationPage.jsx','utf8');
const qa=fs.readFileSync('scripts/qa-rollback-chancery-picker-rls-v158.sql','utf8');
const auth=fs.readFileSync('src/context/AuthContext.jsx','utf8');
const app=fs.readFileSync('src/App.jsx','utf8');

test('V158 note picker counts eligible notes after applying source filter',()=>{
 assert.match(page,/const eligibleNotes=\(notes\|\|\[\]\)\.filter/);
 assert.match(page,/setAvailableNotes\(eligibleNotes\)/);
 assert.match(page,/if\(!eligibleNotes\.length\)setError/);
});
test('V158 changing a decree clears stale note and selections',()=>{
 assert.match(page,/setForm\(v=>\(\{\.\.\.v,decreeId:e\.target\.value,noteId:''\}\)\)/);
 assert.match(page,/setAvailableNotes\(\[\]\)/);
});
test('V158 frontend note eligibility matches backend V156 checks',()=>{
 for(const rule of [".eq('parish_id',decree.parish_id)",".eq('sacrament_id',decree.replacement_record_id)",".eq('status','active')",".eq('note_type','manual')",".is('decree_id',null)",".eq('is_locked',false)",".eq('print_policy','optional')"]){
  assert.ok(page.includes(rule),rule);
 }
});
test('V158 role context provides dioceseId for both institutional roles',()=>{
 assert.match(auth,/dioceseId: prof\.diocese_id \|\| null/);
 assert.match(auth,/chanceryId: prof\.chancery_id \|\| null/);
});
test('V158 routes require separate institutional roles',()=>{
 assert.match(app,/requiredRole=\{ROLE_TYPES\.CHANCERY\}><LaterNoteReconciliationPage/);
 assert.match(app,/requiredRole=\{ROLE_TYPES\.DIOCESE\}><LaterNoteReconciliationPage/);
});
test('V158 RLS fixture is run as authenticated not administrator',()=>{
 assert.match(qa,/SET LOCAL ROLE authenticated/);
 assert.match(qa,/SET LOCAL ROLE authenticated;\s*DO \$qa\$/);
});
test('V158 RLS fixture proves Chancellor can see both entities',()=>{
 assert.match(qa,/picker cannot read own decree under RLS/);
 assert.match(qa,/picker cannot read eligible note under RLS/);
});
test('V158 RLS fixture denies users with no active profile',()=>{
 assert.match(qa,/no-profile actor can read note/);
 assert.match(qa,/no-profile actor can read decree/);
});
test('V158 fixture always reverts fake sacramental records',()=>{
 assert.match(qa,/^BEGIN;$/m);
 assert.match(qa,/ROLLBACK;\s*$/);
 assert.doesNotMatch(qa,/^\s*COMMIT\b/im);
});
