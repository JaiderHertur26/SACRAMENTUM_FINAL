import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('src/services/sharedAuxiliaryCatalogService.js','utf8');
let moduleId=0;
async function harness(rows=[]) {
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const data={parishes:[{id:'A',diocese_id:'D1'},{id:'B',diocese_id:'D1'},{id:'C',diocese_id:'D2'}],dioceses:[{id:'D1'},{id:'D2'}],
    iglesias:rows,ciudades:[],diocesis:[],obispos:[],bishop_tenures:[]};
  const calls=[];
  const client={from(table) {
    const filters=[];let action='select',values=null,bounds=null,single=false;
    const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},order(){return query;},
      range(a,b){bounds=[a,b];return query;},maybeSingle(){single=true;return query;},single(){single=true;return query;},
      insert(v){action='insert';values=v;return query;},update(v){action='update';values=v;return query;},delete(){action='delete';return query;},
      then(resolve,reject){try {
        calls.push({table,action,filters:[...filters],bounds,values});
        const matches=(data[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));
        let result=matches;
        if(action==='insert'){result=(Array.isArray(values)?values:[values]).map((row,i)=>({id:row.id||'new'+i,...row}));data[table].push(...result);}
        if(action==='update'){for(const row of matches)Object.assign(row,values);}
        if(action==='delete'){data[table]=data[table].filter(row=>!matches.includes(row));}
        if(bounds)result=result.slice(bounds[0],bounds[1]+1);
        if(single && action!=='select' && result.length!==1)return Promise.resolve({data:null,error:{code:'PGRST116',message:'No row'}}).then(resolve,reject);
        return Promise.resolve({data:single?(result[0]||null):result,error:null}).then(resolve,reject);
      }catch(error){return Promise.reject(error).then(resolve,reject);}}
    };return query;
  }};
  const key='__auxiliaryTest'+(++moduleId);
  globalThis[key]=client;
  const code=source.replace("import { supabase } from '@/lib/supabaseClient';",`const supabase=globalThis.${key};`);
  const service=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  delete globalThis[key];
  return {service,data,calls,storage};
}

test('Dos parroquias leen las mismas 1.501 iglesias; la tercera solo su diócesis',async()=>{
  const rows=Array.from({length:1501},(_,i)=>({id:String(i),nombre:'IGLESIA '+i,parish_id:'A',diocese_id:'D1'}));
  rows.push({id:'foreign',nombre:'EXTERNA',parish_id:'C',diocese_id:'D2'});
  const {service,calls}=await harness(rows);
  const a=await service.readSharedAuxiliaryCatalog('iglesias','A');
  const b=await service.readSharedAuxiliaryCatalog('iglesias','B');
  const c=await service.readSharedAuxiliaryCatalog('iglesias','C');
  assert.equal(a.length,1501);assert.deepEqual(b,a);assert.deepEqual(c.map(x=>x.id),['foreign']);
  assert.deepEqual(calls.filter(x=>x.table==='iglesias'&&x.filters[0][1]==='D1').map(x=>x.bounds[0]),[0,500,1000,1500,0,500,1000,1500]);
});

test('B edita una iglesia de A sin apropiarse de su procedencia',async()=>{
  const {service,data,calls}=await harness([{id:'one',codigo:'1',nombre:'ORIGINAL',parish_id:'A',diocese_id:'D1'}]);
  const result=await service.writeSharedAuxiliaryCatalog('iglesias','B',{nombre:'EDITADA',parish_id:'B',diocese_id:'D2'},'one');
  assert.equal(result.error,null);assert.equal(data.iglesias[0].parish_id,'A');assert.equal(data.iglesias[0].diocese_id,'D1');
  assert.equal(data.iglesias[0].nombre,'EDITADA');
  assert.deepEqual(calls.find(x=>x.action==='update').filters,[['id','one'],['diocese_id','D1']]);
});

test('Actualizar o borrar una fila de otra diócesis no produce éxito falso',async()=>{
  const {service,data}=await harness([{id:'foreign',nombre:'EXTERNA',parish_id:'C',diocese_id:'D2'}]);
  const update=await service.writeSharedAuxiliaryCatalog('iglesias','B',{nombre:'PROHIBIDO'},'foreign');
  const remove=await service.deleteSharedAuxiliaryCatalog('iglesias','B','foreign');
  assert.ok(update.error);assert.ok(remove.error);assert.equal(data.iglesias[0].nombre,'EXTERNA');
});

test('Alta deriva la diócesis de la parroquia y descarta un ámbito enviado por el cliente',async()=>{
  const {service,data}=await harness();
  const result=await service.writeSharedAuxiliaryCatalog('ciudades','B',{nombre:'NUEVA',context_id:'C',diocese_id:'D2'});
  assert.equal(result.error,null);assert.equal(data.ciudades[0].diocese_id,'D1');assert.equal(data.ciudades[0].context_id,'B');
});

test('Una segunda importación omite lo que ya existe y conserva los originales',async()=>{
  const {service,data}=await harness([{id:'old',nombre:'EXISTENTE',codigo:'ABC',parish_id:'A',diocese_id:'D1'}]);
  const result=await service.importSharedAuxiliaryCatalog('iglesias','B',[
    {id:'duplicate',codigo:'abc',nombre:'NO SUSTITUIR'},
    {id:'new',codigo:'DEF',nombre:'NUEVA'},
    {id:'duplicate2',codigo:'def',nombre:'REPETIDA'}
  ]);
  assert.equal(result.error,null);assert.equal(result.imported,1);assert.equal(result.skipped,2);
  assert.equal(data.iglesias.length,2);assert.equal(data.iglesias[0].nombre,'EXISTENTE');
  assert.equal(data.iglesias[1].parish_id,'B');assert.equal(data.iglesias[1].diocese_id,'D1');
});

test('Párrocos y Mis Datos quedan fuera de toda operación del servicio compartido',async()=>{
  const {service,calls}=await harness();
  for(const table of ['parrocos','mis_datos']){
    await assert.rejects(()=>service.readSharedAuxiliaryCatalog(table,'A'),/no es compartido/);
    await assert.rejects(()=>service.writeSharedAuxiliaryCatalog(table,'A',{}),/no es compartido/);
  }
  assert.equal(calls.length,0);
});

test('No usa un catálogo global cuando la parroquia carece de jurisdicción',async()=>{
  const {service,calls}=await harness();
  await assert.rejects(()=>service.readSharedAuxiliaryCatalog('ciudades','NO_EXISTE'),/resolver la diócesis/);
  assert.equal(calls.filter(x=>x.table==='ciudades').length,0);
});
