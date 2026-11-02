const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const decreeIds=[id(21),id(22)];
const pending=[
 {id:id(11),status:'pending',reportado:false,raw_data:{nombres:'DECRETO_UNO',apellidos:'ENSAYO',source:'new_sacrament',recordOrigin:'chancery_pending_seat_v287',fechaSacramento:'2020-01-01'}},
 {id:id(12),status:'seated',reportado:true,raw_data:{nombres:'DECRETO_DOS',apellidos:'ENSAYO',source:'new_sacrament',recordOrigin:'chancery_pending_seat_v287',fechaSacramento:'2020-01-01'}},
 {id:id(13),status:'pending',reportado:false,raw_data:{nombres:'ORDINARIO_PENDIENTE',apellidos:'ENSAYO',source:'current_parish_registration',fechaSacramento:'2020-01-01'}},
 {id:id(14),status:'seated',reportado:true,raw_data:{nombres:'ORDINARIO_SENTADO',apellidos:'ENSAYO',source:'current_parish_registration',fechaSacramento:'2020-01-01'}},
];
const queue=decreeIds.map((id,i)=>({id,decreeNumber:'Decreto 00'+(i+1),decreeDate:'2020-01-01',sacrament:'bautismo',decreeType:'correccion',effect:'annul_and_create',notificationId:'notice-'+i,notificationStatus:'read',seatStatus:'awaiting_parish'}));
window.__qa325={legacyCalls:[],decreeCalls:[],readMarks:[]};
const auth={user:{id:id(1),parish_id:id(2),parishId:id(2),role:'parish',parishName:'PARROQUIA DE ENSAYO'}};
const getMisDatosList=()=>[];const app={getMisDatosList};
export const useAuth=()=>auth;export const useAppData=()=>app;
const toast=()=>{};export const useToast=()=>({toast});
export const purificarRegistroBautismo=value=>value;
export const getParishPrintProfile=async()=>({});
export const getBaptismParameters=async()=>({ordinarioLibro:1,ordinarioFolio:1,ordinarioNumero:2,ordinarioPartidas:2});
export const calculateNextConsecutive=(numero,folio,libro)=>({numero:numero+1,folio,libro});
export const institutionalConfirm=async()=>true;
export const supabase={
 from(){const q={select(){return q},eq(){return q},order(){return q},then(ok,bad){return Promise.resolve({data:pending,error:null}).then(ok,bad)}};return q;},
 async rpc(name,args){
  if(name==='get_parish_decree_queue_v280'){
   if(new URLSearchParams(location.search).has('fail'))return {data:null,error:{message:'Lectura de ensayo no disponible'}};
   return {data:queue,error:null};
  }
  if(name==='get_parish_decree_books_v280')return {data:{books:[]},error:null};
  if(name==='seat_chancery_decree_v280'){
   window.__qa325.decreeCalls.push(args);queue.find(d=>d.id===args.p_decree_id).seatStatus='seated';
   return {data:{book:args.p_book_code,folio:args.p_folio,number:args.p_number,chanceryNotified:true,notificationCompleted:true},error:null};
  }
  if(name==='seat_baptism_records'){window.__qa325.legacyCalls.push(args);throw Error('No se espera asentar desde la bandeja de Bautismos en este ensayo');}
  throw Error('RPC inesperado '+name);
 }
};

export async function markOfficialNotificationRead(id){window.__qa325.readMarks.push(id);return {id};}
