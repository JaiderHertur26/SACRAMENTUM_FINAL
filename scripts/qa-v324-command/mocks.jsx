import React from 'react';
const requested=new URLSearchParams(location.search).get('role');
export const QA_ROLE=['parish','diocese','chancery','admin_general'].includes(requested)?requested:'parish';
export const QA_PATHS={parish:'/parish/dashboard',diocese:'/diocese/dashboard',chancery:'/chancery/dashboard',admin_general:'/admin/dashboard'};
const parish='00000000-0000-4000-8000-000000000001',diocese='00000000-0000-4000-8000-000000000002',chancery='00000000-0000-4000-8000-000000000003';
const user=Object.freeze({id:'00000000-0000-4000-8000-000000000004',role:QA_ROLE,
 full_name:'Despacho de ensayo',username:'Identidad ficticia',email:'v324@example.invalid',
 parish_id:parish,parishId:parish,diocese_id:diocese,dioceseId:diocese,chancery_id:chancery,chanceryId:chancery,
 parishName:'Parroquia de la Santa Cruz',dioceseName:'Arquidiócesis de Barranquilla',chancelleryName:'Cancillería eclesiástica',
 brandingDioceseId:'452d50bc-ff3e-448e-9b93-1e97f8d321e2',status:'ACTIVE',is_active:true});
const auth=Object.freeze({user,profile:{role:QA_ROLE},logout:async()=>{}});
export const useAuth=()=>auth;
export const AuthProvider=({children})=><>{children}</>;
window.__V324_QA={reads:[],writes:[],notifications:[]};
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
},rpc(name){return unexpectedWrite('rpc '+name);}};
