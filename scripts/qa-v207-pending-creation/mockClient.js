const q=()=>window.__qa207;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const user={id:'00000000-0000-4000-a000-000000000207',role:'parish',parishId:'00000000-0000-4000-a000-000000000112',parishName:'PARROQUIA FICTICIA V207'};
export const useAuth=()=>({user});
const getMisDatosList=()=>[],getParrocos=()=>[],getCiudadesList=()=>[];
export const useAppData=()=>({getMisDatosList,getParrocos,getCiudadesList});
const toast=t=>q().toasts.push(t);export const useToast=()=>({toast});
const dateAuthority=()=>null,aux={currentPriest:null,priestOptions:[],priests:[],churches:[],cities:[],cityOptions:[],bishopAtDate:dateAuthority,priestAtDate:dateAuthority};
export default function useAuxiliaries(){return aux}
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const tableFor={bautismo:'pending_baptisms',confirmacion:'pending_confirmations',matrimonio:'pending_marriages',exequias:'pending_funerals'};
function query(table){
 const filters=[];let single=false;
 const result=()=>{
  const s=q();s.reads++;
  if(s.failRefresh)return {data:null,error:Error('QA V207 lectura de refresco no disponible')};
  if(s.failVerifyOnce&&table===tableFor[s.kind]&&filters.some(([k])=>k==='id')){s.failVerifyOnce=false;return {data:null,error:Error('QA V207 lectura posterior fallida')}}
  let data=[];
  if(table.startsWith('pending_'))data=s.rows.filter(r=>r.table===table).map(r=>({...r}));
  else if(table==='parish_parameters')data=[{id:'params',parish_id:user.parishId,bautizos_params:{numeroRegistroActual:String(s.next-1).padStart(6,'0')},confirmaciones_params:{numeroRegistroActual:String(s.next-1).padStart(6,'0')},matrimonios_params:{},exequias_params:{numeroRegistroActual:String(s.next-1).padStart(6,'0')}}];
  else if(table==='parishes')data=[{id:user.parishId,name:user.parishName}];
  for(const [key,value] of filters)data=data.filter(r=>r[key]===value);
  return {data:single?(data[0]||null):data,error:null};
 };
 const builder={select(){return this},eq(k,v){filters.push([k,v]);return this},order(){return this},limit(){return this},not(){return this},in(){return this},maybeSingle(){single=true;return Promise.resolve(result())},single(){single=true;return Promise.resolve(result())},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
 return builder;
}
export const supabase={from:query,rpc:async(name,args)=>{
 if(name!=='create_pending_registration_v207')return {data:null,error:Error('QA V207 unexpected RPC '+name)};
 const s=q();s.calls.push({...args});await delay(90);
 const id=args.p_request_id,key=args.p_kind+':'+id,hash=JSON.stringify(stable({record:args.p_record,confirmation:args.p_confirmation_record}));
 let receipt=s.receipts.get(key);
 if(receipt&&receipt.hash!==hash)return {data:null,error:Object.assign(Error('Solicitud ya guardada con otros datos; revise las boletas.'),{code:'22023'})};
 if(!s.failureUsed&&s.scenario==='reject-before-save'){s.failureUsed=true;return {data:null,error:Error('QA V207 rechazo antes de guardar')}}
 if(!receipt){
  const number=String(s.next++).padStart(6,'0'),pendingId=crypto.randomUUID(),raw={...args.p_record,id:pendingId,numeroRegistro:number,numero_registro:number};
  s.rows.push({table:tableFor[args.p_kind],id:pendingId,parish_id:args.p_parish_id,raw_data:raw,numero_registro:number,status:'pending',reportado:false,book_type:'ordinario'});
  const response=args.p_kind==='bautismo'?{baptism_pending_id:pendingId,baptism_numero_registro:number,confirmation_pending_id:null,confirmation_numero_registro:null}:{pending_id:pendingId,numero_registro:number,book_type:'ordinario'};
  receipt={hash,response};s.receipts.set(key,receipt);
 }
 if(!s.failureUsed&&(s.scenario==='lost-response'||s.scenario==='changed-after-commit')){s.failureUsed=true;return {data:null,error:Error('Failed to fetch after commit')}}
 if(!s.failureUsed&&s.scenario==='verify-read-failure'){s.failureUsed=true;s.failVerifyOnce=true}
 if(!s.failureUsed&&s.scenario==='refresh-failure'){s.failureUsed=true;s.failRefresh=true}
 return {data:{...receipt.response},error:null};
}};
