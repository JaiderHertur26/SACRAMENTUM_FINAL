import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeBookMemory,canonicalBookKey,exactBookCode,nextBookCoordinates,
  planSacramentalBatch,reverseTerminalSeats} from '../src/domain/sacramentalLedgerSequence.mjs';
const memory=()=>initializeBookMemory({book:'0001A',firstFolio:1,firstNumber:1,entriesPerFolio:3});
const row=(id,date,number)=>({id,celebrationDate:date,registrationNumber:number,celebrationVerified:true});
const coords=(m)=>{const x=nextBookCoordinates(m);return [x.book,x.folio,x.number];};
const begin=m=>({book:m.book,folio:nextBookCoordinates(m).folio,number:nextBookCoordinates(m).number});
test('V252 exact alphanumeric book name and leading zeroes survive',()=>{
 assert.deepEqual(coords(memory()),['0001A','0001','0001']);
 assert.equal(exactBookCode('0001A'),'0001A');
 assert.equal(canonicalBookKey('0001A'),'0001A');
 assert.equal(canonicalBookKey('0001'),'1');
 assert.equal(canonicalBookKey('1'),'1'); // prevent a disguised duplicate numeric ledger
 for(const s of ['',' 0001','0001 ','0001-A','../../a','á','<script>'])assert.throws(()=>exactBookCode(s));
});
test('V252 one to seven entries advance exactly as documented for 3 per folio',()=>{
 let m=memory();
 const got=[];
 for(let i=0;i<7;i++){
  got.push(coords(m).slice(1).join('/'));
  m=planSacramentalBatch({memory:m,records:[row('r'+i,'2026-10-27',String(i+1))],
    today:'2026-10-28',requestedFirst:begin(m)}).nextMemory;
 }
 assert.deepEqual(got,['0001/0001','0001/0002','0001/0003','0002/0004','0002/0005','0002/0006','0003/0007']);
});
test('V252 chronology: celebration date then numeric registration ID',()=>{
 const m=memory();
 const plan=planSacramentalBatch({memory:m,today:'2026-10-28',requestedFirst:begin(m),records:[
  row('a','2026-10-27','20'),row('b','2026-10-25','11'),row('c','2026-10-27','3'),
  row('d','2026-10-26','9')]});
 assert.deepEqual(plan.seats.map(x=>x.pendingId),['b','d','c','a']);
 assert.deepEqual(plan.seats.map(x=>x.folio+'/'+x.number),['0001/0001','0001/0002','0001/0003','0002/0004']);
 assert.equal(m.used,0);assert.equal(plan.nextMemory.used,4);
});
test('V252 different books have independent numbering memories',()=>{
 const a=memory();
 const b=initializeBookMemory({book:'0011',firstFolio:4,firstNumber:50,entriesPerFolio:2});
 const a2=planSacramentalBatch({memory:a,today:'2026-10-28',requestedFirst:begin(a),records:[row('a','2026-10-27','1')]}).nextMemory;
 assert.deepEqual(coords(b),['0011','0004','0050']);
 assert.deepEqual(coords(a2),['0001A','0001','0002']);
});
test('V252 block incorrect next coordinates and invalid capacity',()=>{
 const m=memory();
 for(const bad of [{book:'0001',folio:1,number:1},{book:'0001A',folio:2,number:1},
  {book:'0001A',folio:1,number:2}]){
  assert.throws(()=>planSacramentalBatch({memory:m,today:'2026-10-28',requestedFirst:bad,records:[row('a','2026-10-27','1')]}),/Secuencia esperada/);
 }
 for(const capacity of [0,-1,'1.5'])assert.throws(()=>initializeBookMemory({book:'0001',firstFolio:1,firstNumber:1,entriesPerFolio:capacity}));
 assert.equal(initializeBookMemory({book:'0001',firstFolio:1,firstNumber:1,entriesPerFolio:101}).entriesPerFolio,101);
});
test('V252 refuse future, unverified and duplicate pending records before seat',()=>{
 const m=memory(),data={memory:m,today:'2026-10-28',requestedFirst:begin(m)};
 assert.throws(()=>planSacramentalBatch({...data,records:[row('a','2026-10-29','1')]}));
 assert.throws(()=>planSacramentalBatch({...data,records:[{...row('a','2026-10-27','1'),celebrationVerified:false}]}));
 assert.throws(()=>planSacramentalBatch({...data,records:[row('a','2026-10-27','1'),row('a','2026-10-27','2')]}));
 assert.throws(()=>planSacramentalBatch({...data,records:[row('a','2026-10-27','0001'),row('b','2026-10-27','1')]}),/duplicado/);
 assert.throws(()=>planSacramentalBatch({...data,records:[row('a','2026-02-30','1')]}));
 assert.throws(()=>planSacramentalBatch({...data,records:[row('a','2026-10-27','abc')]}));
 assert.throws(()=>planSacramentalBatch({...data,records:[]}));
});
test('V252 terminal reversal at folio rollover returns exactly to previous pointer',()=>{
 const m=memory();
 const filled=planSacramentalBatch({memory:m,today:'2026-10-28',requestedFirst:begin(m),
  records:[row('1','2026-10-27','1'),row('2','2026-10-27','2'),
    row('3','2026-10-27','3'),row('4','2026-10-27','4')]}).nextMemory;
 assert.deepEqual(coords(filled),['0001A','0002','0005']);
 const reversed=reverseTerminalSeats({memory:filled,authorized:true,positions:[{book:'0001A',folio:'0002',number:'0004'}]});
 assert.deepEqual(coords(reversed.nextMemory),['0001A','0002','0004']);
 assert.equal(reversed.resettable,false);
});
test('V252 reversal within same folio only rewinds the last number',()=>{
 const m=memory();
 const filled=planSacramentalBatch({memory:m,today:'2026-10-28',requestedFirst:begin(m),
  records:[1,2,3,4,5].map(n=>row(String(n),'2026-10-27',String(n)))}).nextMemory;
 const r=reverseTerminalSeats({memory:filled,authorized:true,positions:[{book:'0001A',folio:2,number:5}]});
 assert.deepEqual(coords(r.nextMemory),['0001A','0002','0005']);
});
test('V252 emptying the book resets memory, preserves book scope for external audit',()=>{
 const m=planSacramentalBatch({memory:memory(),today:'2026-10-28',requestedFirst:begin(memory()),
 records:[row('1','2026-10-27','1')]}).nextMemory;
 const r=reverseTerminalSeats({memory:m,authorized:true,positions:[{book:'0001A',folio:1,number:1}]});
 assert.equal(r.resettable,true);assert.deepEqual(coords(r.nextMemory),['0001A','0001','0001']);
});
test('V252 reversing a nonterminal partida never renumbers historical later entries',()=>{
 const m=planSacramentalBatch({memory:memory(),today:'2026-10-28',requestedFirst:begin(memory()),
 records:[1,2,3,4,5].map(n=>row(String(n),'2026-10-27',String(n)))}).nextMemory;
 for(const records of [[{book:'0001A',folio:1,number:1}],
 [{book:'0001A',folio:1,number:3},{book:'0001A',folio:2,number:5}],
 [{book:'0001A',folio:2,number:5},{book:'0001A',folio:2,number:5}]])
   assert.throws(()=>reverseTerminalSeats({memory:m,authorized:true,positions:records}));
 assert.deepEqual(coords(m),['0001A','0002','0006']);
});
test('V252 terminal batch reversal is all-or-nothing and requires authority and no dependencies',()=>{
 const m=planSacramentalBatch({memory:memory(),today:'2026-10-28',requestedFirst:begin(memory()),
 records:[1,2,3,4].map(n=>row(String(n),'2026-10-27',String(n)))}).nextMemory;
 const block=[{book:'0001A',folio:1,number:3},{book:'0001A',folio:2,number:4}];
 assert.throws(()=>reverseTerminalSeats({memory:m,positions:block}));
 assert.throws(()=>reverseTerminalSeats({memory:m,authorized:true,hasActiveDependencies:true,positions:block}));
 const r=reverseTerminalSeats({memory:m,authorized:true,positions:block});
 assert.deepEqual(coords(r.nextMemory),['0001A','0001','0003']);
});
