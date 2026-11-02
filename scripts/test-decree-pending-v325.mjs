import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {isDecreePendingV325 as decree,isOrdinaryPendingV325 as ordinary} from '../src/domain/pendingOriginV325.mjs';
test('V325 preserva pendientes ordinarios e históricos sin confundir texto de observaciones',()=>{
 for(const source of ['new_sacrament','current_parish_registration','legacy_pre_registration',undefined]){
  const row={raw_data:{source,observaciones:'Decreto mencionado en la historia'}};
  assert.equal(ordinary(row),true);assert.equal(decree(row),false);
 }
});
test('V325 detecta origen de decreto antes y después de aplanar y serializar',()=>{
 for(const marker of [{recordOrigin:'chancery_pending_seat_v287'},{record_origin:'CHANCERY_PENDING_SEAT_v280'},{source:'decree'},{source:'chancery_decree'},{source:'decree_supplement'},{source:'new_decree_supplement'},...['decreeId','decree_id','decretoId','decreto_id'].map(k=>({[k]:'decreto-ficticio'}))]){
  for(const row of [marker,{raw_data:marker},{rawData:marker},{raw:marker},{raw_data:JSON.stringify(marker)},JSON.stringify({raw_data:marker})])assert.equal(decree(row),true,JSON.stringify(row));
 }
});
test('V325 un origen corrupto no se convierte en pendiente ordinario',()=>{
 assert.throws(()=>ordinary({raw_data:'{roto'}),/origen/);
});
test('V325 cuatro RPC ordinarios tienen rechazo y relación canónica en la migración',()=>{
 const sql=fs.readFileSync('supabase/deployment/20261102012113_isolate_decree_pending_seats_v325.sql','utf8');
 for(const name of ['seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record'])assert.ok(sql.includes(name));
 assert.ok(sql.includes('public.decretos'));assert.ok(sql.includes('celebration_attestations_v263'));assert.ok(sql.includes("ERRCODE=''23514''"));
 assert.ok(!/GRANT.*authenticated/i.test(sql));assert.ok(!/DELETE FROM/i.test(sql));
});
test('V325 navegador prueba filtros, bandeja y coordenadas manuales de las pantallas reales',()=>{
 const a=JSON.parse(fs.readFileSync('AUDITORIA_DECRETOS_PENDIENTES_V325.json','utf8'));
 assert.equal(a.approved,true);assert.equal(a.failed,0);assert.ok(a.checked>=34);assert.deepEqual(a.exceptions,[]);assert.deepEqual(a.externalRequests,[]);
 for(const [p,hash]of Object.entries(a.source_sha256_lf))assert.equal(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex'),hash,p);
});
