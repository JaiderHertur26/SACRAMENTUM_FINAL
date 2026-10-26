import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('src/services/legacyMigrationService.js','utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function createClient(history=[],error=null){
 const queries=[],rpcs=[];
 const q={select(){return this},eq(name,value){queries.push([name,value]);return this},order(){return this},limit:async()=>({data:history,error})};
 const client={from(table){queries.push(['table',table]);return q},rpc:async(name,args)=>{rpcs.push({name,args});return {error:null}}};
 return {api:new Function('supabase',src+';return {resolveLegacySourceScope,stageLegacyRows}')(client),queries,rpcs};
}
const hash='a'.repeat(64),parishA='00000000-0000-4000-8000-000000000213',parishB='00000000-0000-4000-8000-000000000214';
const args={parishId:parishA,profileKey:'INSBAUTI',hash};
test('V213 fresh file uses parish-specific source namespace',async()=>{
 const v=createClient();
 assert.equal(await v.api.resolveLegacySourceScope(args),parishA+'|'+hash);
 assert.ok(v.queries.some(x=>x[0]==='parish_id'&&x[1]===parishA));
 assert.ok(v.queries.some(x=>x[0]==='sha256'&&x[1]===hash));
 assert.ok(v.queries.some(x=>x[0]==='profile_key'&&x[1]==='INSBAUTI'));
});
test('V213 same JSON imported into two parishes cannot share source keys',async()=>{
 const a=await createClient().api.resolveLegacySourceScope(args);
 const b=await createClient().api.resolveLegacySourceScope({...args,parishId:parishB});
 assert.notEqual(a,b); assert.ok(a.includes(parishA));assert.ok(b.includes(parishB));
});
for (const previous of [[{metadata:{source_scope:hash}}],[{metadata:{}}],[{metadata:null}]]) {
 test('V213 retains original unscoped namespace for older same-parish archive',async()=>{
  assert.equal(await createClient(previous).api.resolveLegacySourceScope(args),hash);
 });
}
test('V213 repeats namespaced V213 import without duplicate boletas',async()=>{
 assert.equal(await createClient([{metadata:{source_scope:parishA+'|'+hash}}]).api.resolveLegacySourceScope(args),parishA+'|'+hash);
});
test('V213 prefers any original archive scope over newer copy',async()=>{
 assert.equal(await createClient([{metadata:{source_scope:parishA+'|'+hash}},{metadata:{source_scope:hash}}]).api.resolveLegacySourceScope(args),hash);
});
test('V213 rejects unknown scope metadata instead of guessing',async()=>{
 await assert.rejects(createClient([{metadata:{source_scope:'bad|scope'}}]).api.resolveLegacySourceScope(args),/incompatibles/);
});
test('V213 must stop before write if reading earlier scope fails',async()=>{
 await assert.rejects(createClient([],Error('server unavailable')).api.resolveLegacySourceScope(args),/server unavailable/);
});
for(const patch of [{parishId:null},{profileKey:''},{hash:'short'}]){
 test('V213 refuses incomplete source identity',async()=>{
  await assert.rejects(createClient().api.resolveLegacySourceScope({...args,...patch}),/procedencia válida/);
 });
}
test('V213 staged source keys include the chosen verified scope for every chunk',async()=>{
 const c=createClient(),rows=Array.from({length:205},(_,i)=>({row_number:i+1,source_key:'book|'+i,target_entity:'pending_baptism',original_data:{},normalized_data:{},status:'valid'}));
 await c.api.stageLegacyRows('batch-qa',rows,200,null,parishA+'|'+hash);
 assert.equal(c.rpcs.length,2);assert.equal(c.rpcs[0].args.p_rows.length,200);assert.equal(c.rpcs[1].args.p_rows.length,5);
 assert.equal(c.rpcs[0].args.p_rows[0].source_key,parishA+'|'+hash+'|book|0');
 assert.equal(c.rpcs[1].args.p_rows[4].source_key,parishA+'|'+hash+'|book|204');
});
test('V213 PostgreSQL migration blocks foreign links, locks concurrent keys and keeps own replays',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261026040729_isolate_legacy_source_links_parish_v213.sql','utf8');
 for(const part of ['pg_advisory_xact_lock','prior.parish_id is distinct from v_batch.parish_id','pending_baptisms','pending_confirmations','baptisms','confirmations','Clave histórica vinculada a otra parroquia','position(v_old in v_ddl)=0','EXECUTE v_ddl']) assert.ok(sql.includes(part),part);
 assert.doesNotMatch(sql,/\bDROP\s+(FUNCTION|TABLE)\b/i);
});
test('V213 database QA contains two boletas and rejects a cross-parish key without persisting',()=>{
 for(const p of ['scripts/qa-rollback-legacy-boletas-v213.sql','scripts/qa-rollback-legacy-scope-guard-v213.sql']){
  const sql=fs.readFileSync(p,'utf8');assert.match(sql,/^BEGIN;$/m);assert.match(sql,/^ROLLBACK;\s*$/m);assert.doesNotMatch(sql,/\bCOMMIT\s*;/i);
 }
 const q=fs.readFileSync('scripts/qa-rollback-legacy-scope-guard-v213.sql','utf8');
 assert.match(q,/foreign_attempt_denied/);assert.match(q,/same_parish_duplicate_reused/);
});
test('V213 UI resolves source scope before batch creation or first write',()=>{
 const jsx=fs.readFileSync('src/pages/admin/LegacyMigrationCenterPage.jsx','utf8');
 const res=jsx.indexOf('await resolveLegacySourceScope(');
 const batch=jsx.indexOf('await createLegacyBatch({');
 const stage=jsx.indexOf('await stageLegacyRows(');
 assert.ok(res>=0&&res<batch&&batch<stage);
 assert.match(jsx,/source_scope:sourceScope/);
 assert.match(jsx,/sourceScope\);/);
});
