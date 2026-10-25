const q=()=>window.__qa206;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const toast=t=>q().toasts.push(t);export const useToast=()=>({toast});
export const useAuth=()=>({user:{id:'qa-user',role:'parish',parishId:'qa-parish',parishName:'PARROQUIA FICTICIA V206'}});
const getMisDatosList=()=>[];export const useAppData=()=>({getMisDatosList,getConfirmationParameters:parameters});
const priestAtDate=()=>null,aux={currentPriest:null,priestAtDate,cityOptions:[],priestOptions:[],churches:[],cities:[]};
export default function useAuxiliaries(){return aux}
export const getParishPrintProfile=async()=>({nombre:'PARROQUIA FICTICIA V206'});
export const purificarRegistroBautismo=r=>({...r});export const purificarRegistroConfirmacion=r=>({...r});
export const getMarginalNoteTemplates=async()=>({});export const institutionalConfirm=async()=>{q().confirmCalls++;await delay(35);return q().confirm};
const read=type=>{q().reads++;if(q().failRead===true||(q().failRead==='pending-only'&&type==='pending'))throw Error('QA V206 lectura no disponible')};
async function parameters(){read('params');return {ordinarioLibro:31,ordinarioFolio:442+Math.floor((q().next-1)/2),ordinarioNumero:q().next,ordinarioPartidas:2,ordinarioRestartNumber:false}}
export const getBaptismParameters=parameters;
export const calculateNextConsecutive=(numero,folio,libro,perPage)=>({numero:numero+1,folio:numero%perPage===0?folio+1:folio,libro});
export const getFuneralParametersCloud=parameters;
export const getPendingFuneralsCloud=async()=>{read('pending');return q().pending.map(r=>({...r}))};
export const getFuneralsCloud=async()=>{read('reported');return q().reported.map(r=>({...r,nombres:r.raw_data.nombres,apellidos:r.raw_data.apellidos}))};
export const createPendingFuneralCloud=async()=>{throw Error('QA V206 unexpected create')};
export const registerHistoricalNarrative=async()=>{throw Error('QA V206 unexpected historical write')};
export const searchBaptismsForFuneralCloud=async()=>[];
const mutate=async(ids,expected)=>{
 const s=q(),attempt=s.calls.length+1;s.calls.push({ids:[...ids],expected});await delay(90);
 if(expected!==undefined&&expected!==s.next)throw Error('QA V206 stale consecutive');
 const fail=!s.failureUsed&&(s.scenario.includes('timeout')||s.scenario.includes('lost')||s.scenario==='individual-read-failure'||s.scenario==='batch-read-failure');
 if(fail)s.failureUsed=true;
 const commit=!fail||s.scenario.includes('lost')||s.scenario.includes('read-failure');
 if(commit){
  for(const id of ids)if(!s.pending.some(r=>r.id===id))throw Error('QA V206 duplicated write');
  for(const id of ids){const row=s.pending.find(r=>r.id===id);s.reported.push({...row,reportado:true,status:'seated',book_number:'31',folio:String(442+Math.floor((s.next-1)/2)),number:String(s.next++)});s.pending=s.pending.filter(r=>r.id!==id)}
 }
 if(s.scenario.includes('read-failure')&&!s.readFailureUsed){s.readFailureUsed=true;s.failRead=true}
 if(fail)throw Object.assign(Error(commit?'Failed to fetch after commit':'canceling statement due to statement timeout'),{code:commit?'FETCH_ERROR':'57014'});
 return {book_number:'31',folio:'442',number:String(s.next-1)};
};
export const seatFuneralRecordCloud=({pendingId})=>mutate([pendingId]);
export const supabase={
 from:table=>{const query={select(){return this},eq(){return this},order(){return this},not(){return this},maybeSingle:async()=>({data:null,error:null}),then(resolve,reject){
  return Promise.resolve().then(()=>{try{read('pending');return {data:[...q().pending,...q().reported].map(r=>({...r})),error:null}}catch(error){return {data:null,error}}}).then(resolve,reject)
 }};return query},
 rpc:async(name,args)=>{try{return {data:await mutate(args.p_records.map(r=>r.pending_id),args.p_expected_number),error:null}}catch(error){return {data:null,error}}}
};
