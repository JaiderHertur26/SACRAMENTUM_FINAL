/* V252 — Deterministic decree order. This is a pure preflight, not an authorization. */
const dateOnly=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Fecha de expedición inválida.');
 const parsed=new Date(value+'T00:00:00Z');
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw Error('Fecha de expedición inválida.');
 return value;
};
const receiptTime=value=>{
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||!/^\d{4}-\d{2}-\d{2}T/.test(value))throw Error('Fecha de recepción inválida.');
 return Date.parse(value);
};
export function orderPendingChanceryDecrees({parishId,decrees}){
 if(typeof parishId!=='string'||!parishId.trim())throw Error('Falta la parroquia.');
 if(!Array.isArray(decrees))throw Error('Se requiere el listado completo de decretos pendientes.');
 const ids=new Set();
 return decrees.filter(x=>x?.status==='pending').map(d=>{
  if(d.parishId!==parishId)throw Error('Hay decretos pendientes de otra parroquia.');
  if(typeof d.id!=='string'||!d.id.trim()||ids.has(d.id))throw Error('Decreto repetido o sin identificación.');
  ids.add(d.id);
  return {...d,issuedDate:dateOnly(d.issuedDate),receivedMillis:receiptTime(d.receivedAt)};
 }).sort((a,b)=>a.issuedDate.localeCompare(b.issuedDate)||
   a.receivedMillis-b.receivedMillis||a.id.localeCompare(b.id));
}
export function assertNextChanceryDecree({parishId,decrees,chosenId}){
 const pending=orderPendingChanceryDecrees({parishId,decrees});
 if(!pending.length)throw Error('No hay decretos pendientes de asiento.');
 if(pending[0].id!==chosenId)throw Error('Primero debe asentarse el decreto pendiente de fecha '+pending[0].issuedDate+'.');
 return Object.freeze({decreeId:chosenId,issuedDate:pending[0].issuedDate,
   expectedPendingCount:pending.length});
}
