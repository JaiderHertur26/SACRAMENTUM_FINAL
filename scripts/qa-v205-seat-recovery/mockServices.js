const q=()=>window.__qa205;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export const useAuth=()=>({user:{id:'qa-user',role:'parish',parishId:'qa-parish'}});
const getMisDatosList=()=>[];export const useAppData=()=>({getMisDatosList});
export const useToast=()=>({toast:t=>q().toasts.push(t)});
export const getParishPrintProfile=async()=>({nombre:'PARROQUIA FICTICIA V205'});
export const supabase={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{name:'PARROQUIA FICTICIA V205'}})})};
export const institutionalConfirm=async()=>{q().confirmCalls++;await delay(40);return q().confirm};
const read=()=>{q().reads++;if(q().failRead)throw Error('QA V205 lectura no disponible')};
export const listPendingMarriagesCloud=async()=>{read();return q().pending.map(x=>({...x}))};
export const listReportedMarriageTicketsCloud=async()=>{read();return q().reported.map(x=>({...x}))};
export const getMatrimonioParameters=async()=>{read();return {ordinarioLibro:31,ordinarioFolio:442,ordinarioNumero:q().next}};
export const seatPendingMarriageCloud=async({pendingId})=>{
 const s=q();s.calls.push(pendingId);await delay(80);
 const attempt=s.calls.length;
 const fail=!s.failureUsed&&((s.scenario.startsWith('individual')&&attempt===1)||(s.scenario.startsWith('batch')&&s.scenario!=='batch-cancel'&&attempt===2));
 if(fail)s.failureUsed=true;
 const committed=!fail||s.scenario.includes('lost')||s.scenario.includes('read-failure');
 if(committed){
  const r=s.pending.find(x=>x.id===pendingId);if(!r)throw Error('QA V205 intento duplicado');
  s.reported.push({...r,status:'seated',book_number:'31',folio:'442',number:String(s.next++)});s.pending=s.pending.filter(x=>x.id!==pendingId);
 }
 if(fail){
  if(s.scenario.includes('read-failure'))s.failRead=true;
  throw Object.assign(Error(committed?'Failed to fetch (respuesta perdida tras guardar)':'canceling statement due to statement timeout'),{code:committed?'FETCH_ERROR':'57014'});
 }
 return {result:{marriage_id:pendingId}};
};
