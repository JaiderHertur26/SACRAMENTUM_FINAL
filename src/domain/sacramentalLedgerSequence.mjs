/* V252 deterministic foliation model. Pure: database mutations belong to one authorized SQL transaction. */
const positive=(value,label,max=2147483647)=>{
  if(!/^\d+$/.test(String(value??'')))throw Error(label+' debe ser un entero positivo.');
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>max)throw Error(label+' fuera de rango.');
  return n;
};
const isoDate=(s)=>{
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha de celebración no válida.');
  const d=new Date(s+'T12:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Fecha de celebración no válida.');
  return s;
};
const pad=n=>String(n).padStart(4,'0');
export function exactBookCode(value){
  if(typeof value!=='string'||!/^[a-zA-Z0-9]{1,32}$/.test(value))throw Error('Libro: use únicamente letras y números, sin espacios.');
  return value;
}
export function canonicalBookKey(value){
  const book=exactBookCode(value).toUpperCase();
  return /^\d+$/.test(book)?String(BigInt(book)):book;
}
export function initializeBookMemory({book,firstFolio,firstNumber,entriesPerFolio}){
  return Object.freeze({book:exactBookCode(book),bookKey:canonicalBookKey(book),
    firstFolio:positive(firstFolio,'Folio inicial'),firstNumber:positive(firstNumber,'Número inicial'),
    entriesPerFolio:positive(entriesPerFolio,'Partidas por folio'),used:0});
}
export function validateState(s){
  if(!s||typeof s!=='object'||canonicalBookKey(s.book)!==s.bookKey)throw Error('Memoria de libro inválida.');
  positive(s.firstFolio,'Folio');positive(s.firstNumber,'Número');
  positive(s.entriesPerFolio,'Partidas por folio');
  if(!Number.isSafeInteger(s.used)||s.used<0)throw Error('Cantidad de asientos inválida.');
  return true;
}
export function nextBookCoordinates(s){
  validateState(s);
  const n=s.firstNumber+s.used,f=s.firstFolio+Math.floor(s.used/s.entriesPerFolio);
  if(!Number.isSafeInteger(n)||n>2147483647||f>2147483647)throw Error('Límite técnico del libro.');
  return Object.freeze({book:s.book,folio:pad(f),number:pad(n),folioNumber:f,entryNumber:n});
}
const compareReg=(a,b)=>{
 const A=String(a??''),B=String(b??'');
 if(!/^\d+$/.test(A)||!/^\d+$/.test(B))throw Error('Número de registro inválido.');
 const x=BigInt(A),y=BigInt(B);return x<y?-1:x>y?1:0;
};
export function planSacramentalBatch({memory,records,today,requestedFirst}){
  validateState(memory);isoDate(today);
  if(!Array.isArray(records)||!records.length||records.length>500)throw Error('El lote requiere de 1 a 500 registros.');
  const expected=nextBookCoordinates(memory);
  if(!requestedFirst||exactBookCode(requestedFirst.book)!==memory.book||
    positive(requestedFirst.folio,'Folio')!==expected.folioNumber||
    positive(requestedFirst.number,'Partida')!==expected.entryNumber)
    throw Error('Secuencia esperada: Libro '+expected.book+', Folio '+expected.folio+', Partida '+expected.number+'.');
  const seen=new Set();
  const registrationKeys=new Set();
  const values=records.map((r,i)=>{
    if(!r||typeof r.id!=='string'||!r.id.trim()||seen.has(r.id))throw Error('Registro duplicado o sin identificación.');
    seen.add(r.id);
    if(r.celebrationVerified!==true)throw Error('Celebración sin comprobación.');
    const date=isoDate(r.celebrationDate);
    if(date>today)throw Error('La celebración aún no ha ocurrido.');
    compareReg(r.registrationNumber,r.registrationNumber);
    const key=String(BigInt(String(r.registrationNumber)));
    if(registrationKeys.has(key))throw Error('Número de registro duplicado en el lote.');
    registrationKeys.add(key);
    return {...r,date,index:i};
  });
  values.sort((a,b)=>a.date.localeCompare(b.date)||compareReg(a.registrationNumber,b.registrationNumber)||a.index-b.index);
  const seats=values.map((r,i)=>{
    const c=nextBookCoordinates({...memory,used:memory.used+i});
    return Object.freeze({pendingId:r.id,celebrationDate:r.date,registrationNumber:String(r.registrationNumber),
      book:c.book,folio:c.folio,number:c.number});
  });
  const nextMemory=Object.freeze({...memory,used:memory.used+seats.length});
  nextBookCoordinates(nextMemory);
  return Object.freeze({seats:Object.freeze(seats),nextMemory});
}
export function reverseTerminalSeats({memory,positions,hasActiveDependencies=false,authorized=false}){
  validateState(memory);
  if(!authorized)throw Error('Se requiere autorización institucional.');
  if(hasActiveDependencies)throw Error('Existen certificados, decretos o referencias relacionadas.');
  if(!Array.isArray(positions)||!positions.length)throw Error('No hay asientos para revertir.');
  const numbers=positions.map(p=>{
    if(!p||canonicalBookKey(p.book)!==memory.bookKey)throw Error('Libro diferente.');
    const n=positive(p.number,'Partida'),ordinal=n-memory.firstNumber;
    if(ordinal<0||ordinal>=memory.used)throw Error('Partida fuera del libro.');
    const f=memory.firstFolio+Math.floor(ordinal/memory.entriesPerFolio);
    if(positive(p.folio,'Folio')!==f)throw Error('Folio incoherente.');
    return ordinal;
  });
  if(new Set(numbers).size!==numbers.length)throw Error('Partida repetida.');
  const sorted=[...numbers].sort((a,b)=>a-b);
  for(let i=0;i<sorted.length;i++)
    if(sorted[i]!==memory.used-sorted.length+i)throw Error('No puede revertirse una partida intermedia.');
  const nextMemory=Object.freeze({...memory,used:memory.used-sorted.length});
  return Object.freeze({nextMemory,nextCoordinates:nextBookCoordinates(nextMemory),resettable:nextMemory.used===0});
}
