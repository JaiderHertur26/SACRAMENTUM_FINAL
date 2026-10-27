import React from 'react';
const params=new URLSearchParams(location.search);
const allowed=new Set(['diocese','chancery','parish','admin_general']);
const role=allowed.has(params.get('role'))?params.get('role'):'parish';
const names={
 diocese:'Arquidiócesis de Barranquilla',
 chancery:'Cancillería · Arquidiócesis de Barranquilla',
 parish:'Parroquia La Santa Cruz',
 admin_general:'Administración General'
};
const fakeUser=Object.freeze({
 id:'qa-visual-no-real-identity',
 role,full_name:'Cuenta Visual de Ensayo',
 username:'Identidad ficticia',
 email:'visual@example.invalid',
 parishId:'qa-fixture-parish',
 dioceseId:'qa-fixture-diocese',
 dioceseName:'Arquidiócesis de Barranquilla',
 parishName:'Parroquia La Santa Cruz',
 chanceryName:'Cancillería',
 brandingDioceseId:'452d50bc-ff3e-448e-9b93-1e97f8d321e2',
 is_active:true,status:'ACTIVE'
});
export const QA_ROLE=role;
export const QA_ENTITY=names[role];
export const useAuth=()=>({user:fakeUser,profile:{role},logout:async()=>{}});
export const AuthProvider=({children})=><>{children}</>;
export const countUnreadOfficialNotifications=async()=>0;
export const countSacramentalNotificationAttention=async()=>0;
export const subscribeToSacramentalNotificationActivity=()=>()=>{};
export const countUnreadChatMessages=async()=>0;
export const subscribeToChatActivity=()=>()=>{};
