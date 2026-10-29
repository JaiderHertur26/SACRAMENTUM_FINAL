import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyBaptismDestination,validateSacramentalCase,summarizeSacramentalCase,DESTINATION,CASE_STATUS} from '../src/domain/sacramentalNotificationCasesV277.mjs';

const S='11111111-1111-4111-8111-111111111111';
const A='22222222-2222-4222-8222-222222222222';
const B='33333333-3333-4333-8333-333333333333';
const X='44444444-4444-4444-8444-444444444444';
const Y='55555555-5555-4555-8555-555555555555';
const local={parishId:S,baptismId:X,name:'Ana María',role:'principal'};
const remote={parishId:A,baptismId:Y,name:'Pedro López',role:'conyuge'};
const external={parishId:null,externalParishName:'San Francisco',externalDioceseName:'Diócesis externa',deliveryReference:'Correo registrado 2026-10',name:'Pedro López',role:'conyuge'};
const physical={parishId:A,searchReference:'Solicitar búsqueda en libro físico de archivo',name:'Pedro López',role:'conyuge'};
const valid=parts=>validateSacramentalCase({sacrament:'matrimonio',senderParishId:S,parties:parts});
test('V277 local digital ambos contrayentes',()=>{
 const x=valid([local,{...remote,parishId:S}]);
 assert.deepEqual(x.map(v=>v.type),['local_digital','local_digital']);
});
test('V277 mismo destino local pero sin datos digitales',()=>{
 const x=valid([{...local,baptismId:null,locator:{book:'0001A',folio:'2',number:'8'}},{...physical,parishId:S}]);
 assert.deepEqual(x.map(v=>v.type),['local_physical','local_physical']);
});
test('V277 solo cónyuge en parroquia registrada distinta',()=>{
 const x=valid([local,remote]);assert.deepEqual(x.map(v=>v.type),['local_digital','system_digital']);
});
test('V277 solo cónyuge en parroquia externa',()=>{
 const x=valid([local,external]);assert.deepEqual(x.map(v=>v.type),['local_digital','external']);
});
test('V277 ambos en otras parroquias registradas (incluso distintas)',()=>{
 const x=valid([{...local,parishId:A},{...remote,parishId:B}]);
 assert.deepEqual(x.map(v=>v.type),['system_digital','system_digital']);
});
test('V277 ambos externos, con nombres y diócesis diferentes',()=>{
 const x=valid([{...external,name:'Ana María',role:'principal'},{...external,name:'Pedro López',role:'conyuge',externalParishName:'San Roque'}]);
 assert.deepEqual(x.map(v=>v.type),['external','external']);
});
test('V277 destino digital interno y físico interno combinados',()=>{
 const x=valid([local,physical]);assert.deepEqual(x.map(v=>v.type),['local_digital','system_physical']);
});
test('V277 confirmación es una sola persona; mismo local y externo',()=>{
 const p={...local,role:'confirmando'};
 assert.equal(validateSacramentalCase({sacrament:'confirmacion',senderParishId:S,parties:[p]})[0].type,'local_digital');
 assert.equal(validateSacramentalCase({sacrament:'confirmacion',senderParishId:S,parties:[{...external,role:'confirmando'}]})[0].type,'external');
});
test('V277 partida duplicada y personas no identificadas rechazadas',()=>{
 assert.throws(()=>valid([local,{...remote,baptismId:X}]),/compartir/);
 assert.throws(()=>valid([local,{...remote,name:''}]),/Identidad/);
});
test('V277 externo nunca se confunde con parroquia digital',()=>{
 assert.throws(()=>valid([local,{...external,baptismId:X}]),/partida digital/);
 assert.throws(()=>valid([local,{...external,externalDioceseName:''}]),/diócesis externas/);
 assert.throws(()=>valid([local,{...external,deliveryReference:''}]),/medio previsto/);
});
test('V277 físico sin coordenadas requiere referencia rastreable',()=>{
 assert.throws(()=>valid([local,{...physical,searchReference:''}]),/referencia de búsqueda/);
});
test('V277 documento no imprimible como completo si alguna devolución externa falta',()=>{
 const x=summarizeSacramentalCase([{type:DESTINATION.LOCAL_DIGITAL,noteApplied:true,status:'completed'},
 {type:DESTINATION.EXTERNAL,status:'processed',returnEvidenceVerified:false}]);
 assert.equal(x.readyToPrint,false);assert.equal(x.status,CASE_STATUS.PARTIAL);
});
test('V277 una aceptación interna no completa ambas destinatarias',()=>{
 const x=summarizeSacramentalCase([{type:DESTINATION.SYSTEM_DIGITAL,status:'processed',noteApplied:true},
 {type:DESTINATION.SYSTEM_DIGITAL,status:'pending'}]);
 assert.deepEqual([x.completed,x.pending,x.readyToPrint],[1,1,false]);
});
test('V277 físico solo se completa si se certificó asiento verdadero',()=>{
 assert.equal(summarizeSacramentalCase([{type:DESTINATION.LOCAL_PHYSICAL,status:'processed'}]).complete,false);
 assert.equal(summarizeSacramentalCase([{type:DESTINATION.LOCAL_PHYSICAL,status:'processed',physicalNoteCertified:true}]).complete,true);
});
test('V277 externo se completa tras recibir y verificar devolución',()=>{
 assert.equal(summarizeSacramentalCase([{type:DESTINATION.EXTERNAL,status:'processed',returnEvidenceVerified:true}]).readyToPrint,true);
});
