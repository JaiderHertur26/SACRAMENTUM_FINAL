import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
test('V292 es una migración histórica inmutable, reemplazada por V293 sin aprobación adicional',()=>{
 const old=read('supabase/migrations/20261029032959_sacramentum_v292_chancery_concept_approval_preflight.sql');
 const latest=read('supabase/migrations/20261029034915_sacramentum_v293_chancery_role_authorized_no_diocese_concept_gate.sql');
 assert.match(old,/check_chancery_decree_concept_v292/);
 assert.match(latest,/DROP FUNCTION IF EXISTS public\.check_chancery_decree_concept_v292/);
 assert.match(latest,/CREATE OR REPLACE FUNCTION public\.issue_chancery_decree_v280/);
});
test('V293 conserva la emisión original V287 sin un prechequeo duplicado',()=>{
 const service=read('src/services/issueDecreeFromFullFormV287.js');
 assert.match(service,/issue_chancery_form_decree_v287/);
 assert.doesNotMatch(service,/checkChanceryDecreeConceptV292|authorization\.approved|approve_decree_concept/);
});
