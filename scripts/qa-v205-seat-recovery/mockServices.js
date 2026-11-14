const q=()=>window.__qa205;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export const useAuth=()=>({user:{id:'qa-user',role:'parish',parishId:'qa-parish'}});
const getMisDatosList=()=>[];export const useAppData=()=>({getMisDatosList});
export const useToast=()=>({toast:t=>q().toasts.push(t)});
export const getParishPrintProfile=async()=>({nombre:'PARROQUIA FICTICIA V205'});
const read=()=>{q().reads++;if(q().failRead)throw Error('QA V205 lectura no disponible')};
export const listPendingMarriagesCloud=async()=>{read();return q().pending.map(x=>({...x}))};
export const listReportedMarriageTicketsCloud=async()=>{read();return q().reported.map(x=>({...x}))};
export const getMatrimonioParameters=async()=>{read();return {ordinarioLibro:31,ordinarioFolio:442,ordinarioNumero:q().next}};
export const supabase={
 from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{name:'PARROQUIA FICTICIA V205'}})}),
 async rpc(name,args) {
  const state=q();
  if(name==='get_parish_seat_context_v328') return {data:{bookType:'ordinario',book:31,folio:442,number:state.next,capacity:1,restart:false,initial:false,firstNumber:1,firstFolio:1}};
  if(name!=='seat_parish_records_v328') throw Error('Unexpected write '+name);
  const ids=args.p_records.map(row=>row.pending_id);
  if(args.p_coordinates.number!==state.next) return {error:Error('QA V328 stale consecutive')};
  state.calls.push(ids);
  await delay(80);
  const failure=!state.failureUsed&&state.scenario!=='batch-cancel';
  if(failure) state.failureUsed=true;
  const committed=!failure||state.scenario.includes('lost')||state.scenario.includes('read-failure');
  if(committed){
   const rows=ids.map(id=>state.pending.find(row=>row.id===id));
   if(rows.some(row=>!row)) throw Error('QA V328 asiento duplicado');
   for(const row of rows) state.reported.push({...row,status:'seated',book_number:'31',folio:'442',number:String(state.next++)});
   state.pending=state.pending.filter(row=>!ids.includes(row.id));
  }
  if(failure){
   if(state.scenario.includes('read-failure')) state.failRead=true;
   return {error:Error(committed?'Failed to fetch (respuesta perdida tras guardar)':'canceling statement due to statement timeout')};
  }
  return {data:{seated_count:ids.length}};
 }
};
