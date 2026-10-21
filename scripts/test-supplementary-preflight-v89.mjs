import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSupplementaryCoordinateAvailable } from '../src/services/supplementaryCoordinatePreflight.mjs';

const fake=(found=[],failure=null)=>{
  const calls=[];
  const query={
    select(v){calls.push(['select',v]);return this;},
    eq(k,v){calls.push(['eq',k,v]);return this;},
    async limit(n){calls.push(['limit',n]);return {data:found,error:failure};}
  };
  return {calls,from(table){calls.push(['from',table]);return query;}};
};

for (const table of ['baptisms','confirmations','marriages','funerals']) {
  test(table+' · coordenada ficticia libre',async()=>{
    const client=fake();
    const result=await assertSupplementaryCoordinateAvailable(client,{
      parishId:'PARROQUIA-FICTICIA',table,book:7,folio:25,number:2
    });
    assert.deepEqual(result,{book:'0007',folio:'0025',number:'0002'});
    assert.ok(client.calls.some(x=>x[0]==='eq'&&x[1]==='parish_id'&&x[2]==='PARROQUIA-FICTICIA'));
  });
  test(table+' · coordenada ocupada: emisión detenida',async()=>{
    await assert.rejects(()=>assertSupplementaryCoordinateAvailable(fake([{id:'ficticio'}]),{
      parishId:'PARROQUIA-FICTICIA',table,book:1,folio:1,number:1
    }),/ya está ocupado/);
  });
}
test('Rechaza coordenadas inválidas antes de consultar',async()=>{
  for (const value of [0,-1,'NaN',1.2,'',null]) {
    await assert.rejects(()=>assertSupplementaryCoordinateAvailable(fake(),{
      parishId:'FICTICIA',table:'baptisms',book:value,folio:1,number:1
    }),/enteros positivos/);
  }
});
test('Rechaza tabla no permitida y falta de parroquia',async()=>{
  for (const p of [{parishId:'FICTICIA',table:'user_profiles'},{parishId:null,table:'baptisms'}]) {
    await assert.rejects(()=>assertSupplementaryCoordinateAvailable(fake(),{...p,book:1,folio:1,number:1}),/tabla y parroquia/);
  }
});
test('Propaga error de Supabase sin simular éxito',async()=>{
  await assert.rejects(()=>assertSupplementaryCoordinateAvailable(fake([],new Error('CONSULTA RECHAZADA')),{
    parishId:'FICTICIA',table:'baptisms',book:1,folio:1,number:1
  }),/CONSULTA RECHAZADA/);
});
