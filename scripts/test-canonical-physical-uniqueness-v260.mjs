import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');

test('V260 protects all 4 physical registries including historical and annulled rows',()=>{
 const sql=read('scripts/staged-v260-canonical-physical-uniqueness.sql');
 for(const [table,name] of [
   ['baptisms','baptism'],['confirmations','confirmation'],
   ['marriages','marriage'],['funerals','funeral']]){
   assert.ok(sql.includes('ALTER TABLE public.'+table+'\n ADD CONSTRAINT ck_v260_'+name));
   assert.ok(sql.includes('CREATE UNIQUE INDEX uq_v260_'+name+'_physical_coordinates'));
   assert.ok(sql.includes('ALTER TABLE public.'+table+' VALIDATE CONSTRAINT ck_v260_'+name));
 }
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 assert.match(sql,/LOCK TABLE public.baptisms,public.confirmations,public.marriages,public.funerals/);
 assert.match(sql,/NULLS NOT DISTINCT/);
 assert.doesNotMatch(sql,/\bWHERE\s+status\s*=/i);
 assert.doesNotMatch(sql,/\bUPDATE\s+public\.|\bDELETE\s+FROM\s+public\.|\bTRUNCATE\b/);
});
test('V260 canonical comparison detects numeric padding and case-insensitive alphanumerics',()=>{
 const sql=read('scripts/staged-v260-canonical-physical-uniqueness.sql');
 for(const key of [
   "ltrim(book_number,'0')","upper(book_number)",
   "ltrim(folio,'0')","ltrim(number,'0')",
   "book_number ~ '^[0-9]+$'",
   "folio ~ '^[0-9]+$'","number ~ '^[0-9]+$'",
   '(lower(book_type))',
   "book_type IS NOT NULL AND lower(book_type) IN ('ordinario','suplementario')"
 ]) assert.ok(sql.includes(key),'Missing normalization '+key);
});
test('V260 physical uniqueness actively tests collisions, concurrency and failed migration rollback',()=>{
 const sh=read('scripts/ci-canonical-physical-uniqueness-v260.sh');
 for(const token of [
   'sacramentum_physical_unique_v260','sacramentum_physical_duplicate_v260',
   'staged-v260-canonical-physical-uniqueness.sql','for table in baptisms confirmations',
   'for table in marriages funerals','annulled','suplementario','pid1=$!',
   'pid2=$!','winners=0','eq "$winners" 1',
   'pg_constraint','pg_indexes','pre-existing','Duplicate fixture',
 ]) assert.ok(sh.toLowerCase().includes(token.toLowerCase()),'Missing test: '+token);
});
test('V260 isolated PG16 suite is in mandatory GitHub CI and master quality gate',()=>{
 const workflow=read('.github/workflows/sacramentum-auditoria-v90.yml');
 const audit=read('scripts/audit-gate-v90.mjs');
 assert.match(workflow,/image: postgres:16/);
 assert.match(workflow,/bash scripts\/ci-canonical-physical-uniqueness-v260\.sh/);
 assert.match(audit,/scripts\/test-canonical-physical-uniqueness-v260\.mjs/);
});
