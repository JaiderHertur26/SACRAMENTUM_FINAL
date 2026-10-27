import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/services/catalogsService.js','utf8');
const ui=fs.readFileSync('src/pages/parish/auxiliary/ParrocosList.jsx','utf8');
const fragment=source.slice(source.indexOf('const safeJsonParse'),source.indexOf('// ============================================================================\n// ⛪ IGLESIAS'));
function fixture({rpcError=false}={}){
 const rows=new Map(),calls=[],store=new Map();
 let serial=0;
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const supabase={
  rpc:async(name,params)=>{calls.push({method:'rpc',name,params});return {error:rpcError?new Error('QA RPC unavailable'):null};},
  from:table=>{
   assert.equal(table,'parrocos');
   const state={action:null,record:null,filters:[]};
   const q={
    insert:record=>{calls.push({method:'insert'});record.forEach(x=>rows.set(x.id,x));return Promise.resolve({error:null});},
    update:record=>{state.action='update';state.record=record;return q;},
    delete:()=>{state.action='delete';return q;},
    select:()=>{if(!state.action)state.action='select';return q;},
    eq:(k,v)=>{state.filters.push([k,v]);return q;},
    order:()=>q,
    maybeSingle:async()=>{
     calls.push({method:state.action,filters:[...state.filters]});
     const matches=[...rows.values()].filter(row=>state.filters.every(([k,v])=>row[k]===v));
     const row=matches[0];
     if(!row)return {data:null,error:null};
     if(state.action==='delete')rows.delete(row.id);
     if(state.action==='update')rows.set(row.id,{...row,...state.record});
     return {data:{id:row.id},error:null};
    },
    then:(yes,no)=>Promise.resolve({data:[...rows.values()].filter(row=>state.filters.every(([k,v])=>row[k]===v)),error:null}).then(yes,no)
   };
   return q;
  }
 };
 const code=fragment.replaceAll('export const ','const ')+'\n({actualizarParrocoActual,addParroco,updateParroco,deleteParroco,importParrocos})';
 const api=vm.runInNewContext(code,{supabase,localStorage,generateUUID:()=>('qa-'+(++serial)),console:{error:()=>{}},Date,JSON});
 const seed=(parish,id)=>{
  rows.set(id,{id,parish_id:parish,nombre:'Inicial'});
  store.set('parrocos_'+parish,JSON.stringify([{id,parish_id:parish,nombre:'Inicial'}]));
 };
 return {rows,calls,store,api,seed};
}
test('V237 foreign-parish update never reaches database if id absent from scoped cache',async()=>{
 const f=fixture();f.seed('A','id1');
 const out=await f.api.updateParroco('id1',{nombre:'X'},'B');
 assert.equal(out.success,false);
 assert.equal(f.calls.length,0);
 assert.equal(f.rows.get('id1').nombre,'Inicial');
});
test('V237 forged cache cannot bypass parish filter in update',async()=>{
 const f=fixture();f.seed('A','id1');
 f.store.set('parrocos_B',JSON.stringify([{id:'id1',nombre:'X'}]));
 const out=await f.api.updateParroco('id1',{nombre:'Atacante'},'B');
 assert.equal(out.success,false);
 assert.deepEqual(f.calls.find(c=>c.method==='update').filters,[['id','id1'],['parish_id','B']]);
 assert.equal(f.rows.get('id1').nombre,'Inicial');
});
test('V237 update success confirms exact row and recalculates parish',async()=>{
 const f=fixture();f.seed('A','id1');
 const out=await f.api.updateParroco('id1',{nombre:'Correcto'},'A');
 assert.equal(out.success,true);
 assert.equal(f.rows.get('id1').nombre,'Correcto');
 assert.ok(f.calls.some(c=>c.method==='rpc'&&c.params.p_parish_id==='A'));
});
test('V237 delete wrong parish never removes existing row',async()=>{
 const f=fixture();f.seed('A','id1');
 const out=await f.api.deleteParroco('id1','B');
 assert.equal(out.success,false);
 assert.deepEqual(f.calls.find(c=>c.method==='delete').filters,[['id','id1'],['parish_id','B']]);
 assert.ok(f.rows.has('id1'));
});
test('V237 failed recalculation of a committed deletion is surfaced without claiming rollback',async()=>{
 const f=fixture({rpcError:true});f.seed('A','id1');
 const out=await f.api.deleteParroco('id1','A');
 assert.equal(out.success,true);
 assert.equal(out.requiresAttention,true);
 assert.ok(!f.rows.has('id1'));
});
test('V237 committed add with failed recalculation is not falsely described as failed insert',async()=>{
 const f=fixture({rpcError:true});
 const out=await f.api.addParroco({nombre:'Nuevo'},'A');
 assert.equal(out.success,true);
 assert.equal(out.requiresAttention,true);
 assert.equal(f.rows.size,1);
});
test('V237 committed update with failed recalculation requires review',async()=>{
 const f=fixture({rpcError:true});f.seed('A','id1');
 const out=await f.api.updateParroco('id1',{nombre:'Persistió'},'A');
 assert.equal(out.success,true);
 assert.equal(out.requiresAttention,true);
 assert.equal(f.rows.get('id1').nombre,'Persistió');
});
test('V237 null parish cannot mutate data',async()=>{
 const f=fixture();f.seed('A','id1');
 assert.equal((await f.api.addParroco({nombre:'X'},null)).success,false);
 assert.equal((await f.api.updateParroco('id1',{nombre:'X'},null)).success,false);
 assert.equal((await f.api.deleteParroco('id1',null)).success,false);
 assert.equal(f.rows.size,1);
 assert.equal(f.calls.length,0);
});
test('V237 UI warns when persisted mutation needs reconciliation',()=>{
 assert.equal((ui.match(/result\.requiresAttention/g)||[]).length,3);
 assert.match(ui,/Revisión requerida/);
});
