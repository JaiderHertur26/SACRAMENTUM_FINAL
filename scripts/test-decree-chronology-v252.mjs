import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNextChanceryDecree,orderPendingChanceryDecrees} from '../src/domain/chanceryDecreeOrder.mjs';
const d=(id,issuedDate,receivedAt,status='pending')=>({id,parishId:'parroquia-a',issuedDate,receivedAt,status});
const pending=[
 d('latest','2026-10-29','2026-10-27T08:00:00Z'),
 d('first-received','2026-10-21','2026-10-22T08:00:00Z'),
 d('oldest','2026-10-19','2026-10-20T09:00:00Z'),
 d('second-received','2026-10-21','2026-10-22T09:00:00Z'),
 d('already-seated','2026-10-10','2026-10-11T10:00:00Z','seated')
];
test('V252 decrees must be seated by issuance date and then reception chronology',()=>{
 const order=orderPendingChanceryDecrees({parishId:'parroquia-a',decrees:pending});
 assert.deepEqual(order.map(x=>x.id),['oldest','first-received','second-received','latest']);
});
test('V252 reading or accepting a notification cannot skip an earlier pending decree',()=>{
 assert.throws(()=>assertNextChanceryDecree({parishId:'parroquia-a',decrees:pending,chosenId:'latest'}));
 assert.equal(assertNextChanceryDecree({parishId:'parroquia-a',decrees:pending,chosenId:'oldest'}).decreeId,'oldest');
});
test('V252 after the first decree is seated, next one becomes available',()=>{
 const ready=pending.map(x=>x.id==='oldest'?{...x,status:'seated'}:x);
 assert.equal(assertNextChanceryDecree({parishId:'parroquia-a',decrees:ready,chosenId:'first-received'}).decreeId,'first-received');
});
test('V252 cross-parish pending decrees cannot contaminate or bypass ordering',()=>{
 assert.throws(()=>orderPendingChanceryDecrees({parishId:'parroquia-a',
 decrees:[...pending,{...d('foreign','2026-10-01','2026-10-02T00:00:00Z'),parishId:'parroquia-b'}]}));
});
test('V252 reject missing dates and duplicates, no silent fallback',()=>{
 assert.throws(()=>orderPendingChanceryDecrees({parishId:'parroquia-a',decrees:[d('a','','2026-10-01T00:00:00Z')]}));
 assert.throws(()=>orderPendingChanceryDecrees({parishId:'parroquia-a',decrees:[d('a','2026-10-21','broken')]}));
 assert.throws(()=>orderPendingChanceryDecrees({parishId:'parroquia-a',decrees:[d('a','2026-10-21','2026-10-21T01:00:00Z'),d('a','2026-10-22','2026-10-22T01:00:00Z')]}));
 assert.throws(()=>assertNextChanceryDecree({parishId:'parroquia-a',decrees:[],chosenId:'whatever'}));
});
test('V252 ties on both times have deterministic UUID ordering',()=>{
 const p=[d('z','2026-10-21','2026-10-22T11:30:00Z'),d('a','2026-10-21','2026-10-22T11:30:00Z')];
 assert.deepEqual(orderPendingChanceryDecrees({parishId:'parroquia-a',decrees:p}).map(x=>x.id),['a','z']);
});
