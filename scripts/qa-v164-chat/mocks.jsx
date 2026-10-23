import React from 'react';
const uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const personA={user:{id:uuid(1),role:'parish',dioceseId:uuid(11),parishId:uuid(111)},
 profile:{id:uuid(101),role:'parish',diocese_id:uuid(11),parish_id:uuid(111),is_active:true,status:'ACTIVE'}};
const personB={user:{id:uuid(2),role:'chancery',dioceseId:uuid(22),chanceryId:uuid(222)},
 profile:{id:uuid(102),role:'chancery',diocese_id:uuid(22),chancery_id:uuid(222),is_active:true,status:'ACTIVE'}};
let actor=personA;
const rooms={
 A:[{id:uuid(501),kind:'diocesan',name:'SALA PRIVADA DIÓCESIS A',organization:'JURISDICCIÓN A',last_message:'SECRETO A V164',unread_count:1,last_message_at:'2026-10-23T12:00:00Z'}],
 B:[{id:uuid(502),kind:'diocesan',name:'SALA PRIVADA DIÓCESIS B',organization:'JURISDICCIÓN B',last_message:'SECRETO B V164',unread_count:1,last_message_at:'2026-10-23T12:01:00Z'}]
};
const messages={
 A:[{id:uuid(701),room_id:uuid(501),body:'MENSAJE CONFIDENCIAL A · V164',sender_profile_id:uuid(151),sender_name:'Usuario A',created_at:'2026-10-23T12:00:00Z'}],
 B:[{id:uuid(702),room_id:uuid(502),body:'MENSAJE CONFIDENCIAL B · V164',sender_profile_id:uuid(152),sender_name:'Usuario B',created_at:'2026-10-23T12:01:00Z'}]
};
const key=()=>actor?.profile?.diocese_id===uuid(11)?'A':'B';
window.__chatqa={
 subscriptions:0,subscribed:0,unsubscribed:0,history:[],slowA:false,
 changeIdentity(name){actor=name==='A'?personA:name==='B'?personB:null;
  window.dispatchEvent(new Event('v164-auth-change'));},
 setSlowA(v){window.__chatqa.slowA=v;}
};
const delay=async(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
export default function DashboardLayout({children}){return <div className="min-h-screen bg-slate-100">
 <div className="bg-amber-100 border-b border-amber-300 p-2 text-center text-xs font-bold text-amber-900">V164 · CHAT AISLADO · IDENTIDADES FICTICIAS · SIN CONEXIÓN SUPABASE</div>{children}</div>;}
export const useAuth=()=>{
 const [state,setState]=React.useState(actor);
 React.useEffect(()=>{const update=()=>setState(actor?{...actor}:null);
 window.addEventListener('v164-auth-change',update);
 return ()=>window.removeEventListener('v164-auth-change',update);},[]);
 return {profile:state?.profile||null,user:state?.user||null};
};
export const ensureDiocesanChatDefaults=async()=>({qa:true});
export const listChatDirectory=async()=>actor?[{profile_id:uuid(key()==='A'?151:152),name:'DIRECTORIO FICTICIO '+key(),organization:'QA',role:'diocese'}]:[];
export const listMyChatRooms=async()=>{
 const scope=key(),result=rooms[scope].map(x=>({...x}));
 if(scope==='A'&&window.__chatqa.slowA)await delay(900);else await delay(65);
 return result;
};
export const getChatRoomMessages=async(roomId)=>{
 const scope=roomId===uuid(501)?'A':'B';
 if(scope==='A'&&window.__chatqa.slowA)await delay(900);else await delay(65);
 return messages[scope].map(x=>({...x}));
};
export const markChatRoomRead=async()=>{};
export const requestChatBadgeRefresh=()=>{};
export const sendChatMessage=async(room,body)=>{window.__chatqa.history.push({action:'send',room,body});return {id:uuid(888)};};
export const startDirectChat=async()=>{window.__chatqa.history.push({action:'start'});return uuid(501);};
export const subscribeToChatRoom=async()=>{
 window.__chatqa.subscribed++;window.__chatqa.subscriptions++;
 return ()=>{window.__chatqa.unsubscribed++;window.__chatqa.subscriptions--;};
};
