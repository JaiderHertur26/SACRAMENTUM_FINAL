// V172 · Cross-diocese permissions regression for historical episcopal tenures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/20261023190421_isolate_bishop_tenures_by_diocese_v172.sql','utf8');
const post=fs.readFileSync('scripts/qa-rollback-bishop-tenure-jurisdiction-v172.sql','utf8');
const pre=fs.readFileSync('scripts/qa-rollback-bishop-tenure-cross-diocese-repro-v172.sql','utf8');
for(const op of ['select','insert','update','delete']){
 test('V172 enforces scoped '+op+' policies for authenticated users',()=>{
  assert.match(migration,new RegExp('DROP POLICY IF EXISTS bishop_tenures_parish_'+op));
  assert.match(migration,new RegExp('CREATE POLICY bishop_tenures_parish_'+op));
  assert.match(migration,new RegExp('FOR '+op.toUpperCase()+' TO authenticated'));
 });
}
test('V172 filters by actual diocese rather than role only',()=>{
 assert.match(migration,/up\.diocese_id=p\.diocese_id/);
 assert.match(migration,/JOIN public\.parishes p ON p\.id=bishop_tenures\.parish_id/);
 assert.match(migration,/up\.diocese_id IS NOT NULL/);
});
test('V172 active status and explicit roles required',()=>{
 assert.match(migration,/up\.is_active IS TRUE/);
 assert.match(migration,/lower\(coalesce\(up\.status,'active'\)\)='active'/);
 for(const role of ['admin_general','diocese','archdiocese','parish'])assert.ok(migration.includes(role));
 assert.match(migration,/up\.parish_id=bishop_tenures\.parish_id/);
});
test('V172 insert/update always check new row tenant',()=>{
 assert.match(migration,/FOR INSERT TO authenticated WITH CHECK/);
 assert.match(migration,/FOR UPDATE TO authenticated USING/);
 assert.match(migration,/WITH CHECK \(EXISTS \(/);
});
test('V172 does not mutate sacramental data, users, or SQL grants',()=>{
 assert.doesNotMatch(migration,/\bINSERT INTO\b|\bUPDATE\s+public\.|\bDELETE FROM\b|\bDROP TABLE\b|\bGRANT\b|\bREVOKE\b/i);
 assert.match(migration,/ALTER TABLE public\.bishop_tenures ENABLE ROW LEVEL SECURITY/);
});
test('V172 prepatch reproduced cross-diocese read and unauthorized delete using rollback',()=>{
 assert.match(pre,/V172 PREPATCH/);
 assert.match(pre,/SELECT count\(\*\) INTO seen_count FROM public\.bishop_tenures/);
 assert.match(pre,/DELETE FROM public\.bishop_tenures WHERE id=foreign_tenure/);
 assert.match(pre,/ROLLBACK;\s*$/);
});
test('V172 postpatch QA includes foreign SELECT UPDATE DELETE INSERT denials',()=>{
 for(const name of ['foreign diocese could READ','foreign diocese could UPDATE','foreign diocese could DELETE','foreign diocese could INSERT'])
  assert.ok(post.includes(name),name);
 assert.match(post,/EXCEPTION WHEN insufficient_privilege THEN denied:=true/);
});
test('V172 postpatch QA checks own parish CRUD and general admin access',()=>{
 for(const name of ['owning parish could not READ','owning parish could not UPDATE','owning parish could not DELETE','general admin lost global visibility'])
  assert.ok(post.includes(name),name);
 assert.match(post,/QA V172 OWN INSERT/);
});
test('V172 suspended parish loses visibility; both QA fixtures reversible',()=>{
 assert.match(post,/status='SUSPENDED'/);
 assert.match(post,/suspended parish could READ tenure/);
 for(const src of [pre,post]){
  assert.match(src,/^BEGIN;$/m);assert.match(src,/ROLLBACK;\s*$/);
  assert.doesNotMatch(src,/^\s*COMMIT\s*;/mi);
  assert.match(src,/@example\.invalid/);
 }
});
