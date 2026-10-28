import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeBookMemory,nextBookCoordinates,planSacramentalBatch,reverseTerminalSeats} from '../src/domain/sacramentalLedgerSequence.mjs';
const row=(n)=>({id:'new-'+n,flow:'new_sacrament',registrationNumber:String(n),celebrationDate:'2026-10-27',celebrationVerified:true});
const make=(opts={})=>initializeBookMemory({book:'0001A',firstFolio:8,firstNumber:50,entriesPerFolio:2,...opts});
const coordinates=m=>{const {folio,number}=nextBookCoordinates(m);return folio+'/'+number;};
const plan=(m,ids)=>planSacramentalBatch({memory:m,today:'2026-10-28',
 requestedFirst:nextBookCoordinates(m),records:ids.map(row)});
test('V261 continuous mode retains existing official sequence and 4-digit book',()=>{
 const m=make(),p=plan(m,[1,2,3,4,5]);
 assert.deepEqual(p.seats.map(s=>s.folio+'/'+s.number),['0008/0050','0008/0051','0009/0052','0009/0053','0010/0054']);
 assert.equal(coordinates(p.nextMemory),'0010/0055');
});
test('V261 reset mode supports first numbered physical folio and subsequent reset',()=>{
 const m=make({restartNumberPerFolio:true});
 const p=plan(m,[1,2,3,4,5]);
 assert.deepEqual(p.seats.map(s=>s.folio+'/'+s.number),['0008/0050','0008/0051','0009/0001','0009/0002','0010/0001']);
 assert.equal(coordinates(p.nextMemory),'0010/0002');
 assert.equal(m.used,0);
});
test('V261 reset mode cannot reverse equal-number intermediary from previous folio',()=>{
 const p=plan(make({restartNumberPerFolio:true}),[1,2,3,4,5]);
 const m=p.nextMemory;
 assert.throws(()=>reverseTerminalSeats({memory:m,authorized:true,positions:[{book:'0001A',folio:9,number:1}]}),/intermedia/i);
 assert.throws(()=>reverseTerminalSeats({memory:m,authorized:true,positions:[{book:'0001A',folio:10,number:2}]}));
 const reversed=reverseTerminalSeats({memory:m,authorized:true,positions:[{book:'0001A',folio:10,number:1}]});
 assert.equal(coordinates(reversed.nextMemory),'0010/0001');
 assert.equal(coordinates(reverseTerminalSeats({memory:reversed.nextMemory,authorized:true,
   positions:[{book:'0001A',folio:9,number:2}]}).nextMemory),'0009/0002');
});
test('V261 last folio reverse with two positions returns precise previous slot',()=>{
 const m=plan(make({restartNumberPerFolio:true}),[1,2,3,4,5]).nextMemory;
 const result=reverseTerminalSeats({memory:m,authorized:true,positions:[
  {book:'0001A',folio:9,number:2},{book:'0001A',folio:10,number:1}
 ]});
 assert.equal(coordinates(result.nextMemory),'0009/0002');
});
test('V261 validates restart mode and preserves irreversible physical-book configuration',()=>{
 assert.throws(()=>make({restartNumberPerFolio:'true'}));
 const sql=fs.readFileSync('scripts/qa-v252-ledger-memory-schema.sql','utf8');
 assert.match(sql,/restart_partida_each_folio boolean NOT NULL DEFAULT false/);
 assert.match(sql,/NEW\.restart_partida_each_folio IS DISTINCT FROM OLD\.restart_partida_each_folio/);
 assert.match(sql,/UNIQUE \(book_id,folio,partida\)/);
 assert.doesNotMatch(sql,/UNIQUE \(book_id,partida\)/);
});
test('V261 private SQL and physical-boundary SQL share exactly the same reset model',()=>{
 const kernel=fs.readFileSync('scripts/qa-v253-ledger-transactions.sql','utf8');
 const physical=fs.readFileSync('scripts/qa-v259-atomic-physical-seat.sql','utf8');
 assert.match(kernel,/m\.restart_partida_each_folio AND cnt>=m\.partidas_per_folio/);
 assert.match(kernel,/m\.restart_partida_each_folio AND m\.active_count>=m\.partidas_per_folio/);
 assert.match(physical,/m\.restart_partida_each_folio AND m\.active_count\+v_index>=m\.partidas_per_folio/);
 const ci=fs.readFileSync('scripts/ci-restarting-folio-v261.sh','utf8');
 assert.match(ci,/qa_atomic_seat_v259/);
 assert.match(ci,/qa_reverse_physical_tail_v261/);
 assert.match(fs.readFileSync('scripts/qa-v261-physical-tail-reversal.sql','utf8'),/qa_reverse_tail_v253/);
 assert.match(ci,/v261_folio_rollback/);
});
