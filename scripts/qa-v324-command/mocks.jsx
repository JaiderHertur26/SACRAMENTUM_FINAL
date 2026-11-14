import React from 'react';
export const QA_PATHS={parish:'/parish/dashboard',diocese:'/diocese/dashboard',chancery:'/chancery/dashboard',admin_general:'/admin/dashboard'};
const requested=new URLSearchParams(location.search).get('role');
export const QA_ROLE=Object.hasOwn(QA_PATHS,requested)?requested:
 Object.keys(QA_PATHS).find(role=>QA_PATHS[role]===location.pathname)||'parish';
const parish='00000000-0000-4000-8000-000000000001',diocese='00000000-0000-4000-8000-000000000002',chancery='00000000-0000-4000-8000-000000000003';
const user=Object.freeze({id:'00000000-0000-4000-8000-000000000004',role:QA_ROLE,
 full_name:'Despacho de ensayo',username:'Identidad ficticia',email:'v324@example.invalid',
 parish_id:parish,parishId:parish,diocese_id:diocese,dioceseId:diocese,chancery_id:chancery,chanceryId:chancery,
 parishName:'Parroquia de la Santa Cruz',dioceseName:'Arquidiócesis de Barranquilla',chancelleryName:'Cancillería eclesiástica',
 brandingDioceseId:'452d50bc-ff3e-448e-9b93-1e97f8d321e2',status:'ACTIVE',is_active:true});
const auth=Object.freeze({role:QA_ROLE,user,profile:{role:QA_ROLE,id:'qa-profile'},
 parishId:parish,dioceseId:diocese,chanceryId:chancery,logout:async()=>{}});
export const useAuth=()=>auth;
export const AuthProvider=({children})=><>{children}</>;
window.__V324_QA={reads:[],writes:[],notifications:[],backupActions:[]};
const unexpectedWrite=(name)=>{window.__V324_QA.writes.push(name);throw Error('Escritura inesperada en ensayo de navegación: '+name);};
const app=Object.freeze({data:{communications:[{id:'qa-message'}]},getMisDatosList:()=>[],
 updateMisDatosRecord:()=>unexpectedWrite('updateMisDatos'),addMisDatosRecord:()=>unexpectedWrite('addMisDatos')});
export const useAppData=()=>app;
const toast={toast:(value)=>window.__V324_QA.notifications.push(value)};
export const useToast=()=>toast;
export const countUnreadOfficialNotifications=async()=>2;
export const countSacramentalNotificationAttention=async()=>1;
export const subscribeToSacramentalNotificationActivity=()=>()=>{};
export const countUnreadChatMessages=async()=>1;
export const subscribeToChatActivity=()=>()=>{};
export const purificarRegistroBautismo=row=>({...row.raw_data,id:row.id,status:row.status});
export const loadChanceryPendingSacraments=async()=>({rows:[{
 id:'qa-pending',personName:'Persona de ensayo',parishName:'Parroquia de ensayo',sacramentType:'Bautismo',sacramentDate:'01/11/2026',
}]});
export const listChanceryDecreeReceiptsV280=async()=>[];
export const markChanceryDecreeReceiptReadV280=()=>unexpectedWrite('markReceipt');
const profiles=[
 {id:'qa-profile',auth_user_id:user.id,diocese_id:diocese,parish_id:parish,role:'parish',is_active:true,status:'ACTIVE'},
 {id:'qa-diocese-profile',auth_user_id:'00000000-0000-4000-8000-000000000005',diocese_id:diocese,role:'diocese',is_active:true,status:'ACTIVE'},
];
const backupSection={parish:'bautismos',diocese:'informes',chancery:'decretos',admin_general:'diocesis'}[QA_ROLE];
const backupRows=Array.from({length:QA_ROLE==='parish'?26:1},(_,index)=>({id:'qa-row-'+index,nombre:'Registro de ensayo '+(index+1)}));
const backupFile={format:'SACRAMENTUM_PERSONAL_BACKUP',version:1,role:QA_ROLE,exportedAt:'2026-11-01T12:00:00.000Z',
 sealed:'a'.repeat(80),integrity:'b'.repeat(64)};
let privateCopy=null;
function backupResponse(args) {
 window.__V324_QA.backupActions.push(args.p_action);
 switch(args.p_action){
  case 'status': return {data:{role:QA_ROLE,copy:privateCopy}};
  case 'export': return {data:backupFile};
  case 'import':
   if(args.p_file.integrity!==backupFile.integrity)return {error:{message:'La copia está dañada o pertenece a otra cuenta o ámbito.'}};
   privateCopy={id:parish,exportedAt:backupFile.exportedAt,sections:{[backupSection]:backupRows.length}};
   return {data:privateCopy};
  case 'section':
   if(args.p_copy_id!==privateCopy?.id||args.p_section!==backupSection)return {error:{message:'Sección de ensayo no disponible'}};
   return {data:{total:backupRows.length,rows:backupRows.slice(args.p_offset,args.p_offset+25)}};
  default: return {error:{message:'Operación de ensayo inesperada'}};
 }
}
export const supabase={from(table){
 const query={table,filters:[],head:false,single:false};
 const builder={
  select(columns,options={}){query.columns=columns;query.head=!!options.head;return builder;},
  eq(key,value){query.filters.push([key,value]);return builder;},
  in(key,value){query.filters.push([key,value]);return builder;},
  order(){return builder;},limit(){return builder;},range(){return builder;},
  single(){query.single=true;return builder;},maybeSingle(){query.single=true;return builder;},
  insert(){return unexpectedWrite(table+'.insert');},update(){return unexpectedWrite(table+'.update');},
  upsert(){return unexpectedWrite(table+'.upsert');},delete(){return unexpectedWrite(table+'.delete');},
  then(ok,bad){
   window.__V324_QA.reads.push({...query});
   const result=()=>{
    if(new URLSearchParams(location.search).has('fail'))return {data:null,error:{message:'Error de lectura simulado'},count:null};
    const rows={
     dioceses:[{id:diocese,name:'Arquidiócesis de Barranquilla',type:'archdiocese'}],
     user_profiles:profiles,parishes:[{id:parish,name:'Parroquia de la Santa Cruz',diocese_id:diocese,is_operational:true}],
     chancelleries:[{id:chancery,name:'Cancillería eclesiástica',city:'Barranquilla'}],
     pending_tokens:[{id:'qa-token',token:'CODIGO-FICTICIO',payload:{name:'Jurisdicción de ensayo'},created_at:'2026-11-01'}],
     pending_baptisms:[{id:'qa-pending-baptism',raw_data:{firstName:'Persona',lastName:'de ensayo'},status:'pending'}],
    }[table]||[];
    const count={parishes:3,vicarias:1,decanatos:2,baptisms:4,confirmations:3,marriages:2,funerals:1,
     decretos:query.filters.some(([key,val])=>key==='tipo'&&val==='reposicion')?3:2}[table]??rows.length;
    return {data:query.head?null:query.single?(rows[0]||null):rows,error:null,count};
   };
   return Promise.resolve(result()).then(ok,bad);
  },
 };
 return builder;
},rpc(name,args){
 if(name!=='personal_backup_v329')return unexpectedWrite('rpc '+name);
 return {abortSignal:signal=>Promise.resolve(signal.aborted?{error:{message:'Solicitud cancelada'}}:backupResponse(args))};
}};