import React from 'react';
const params=new URLSearchParams(location.search);
const role=params.get('role')==='diocese'?'diocese':'chancery';
const uuid=x=>'00000000-0000-0000-0000-'+String(x).padStart(12,'0');
const records=[
{id:uuid(101),decree_id:uuid(201),note_id:uuid(301),diocese_id:uuid(1),parish_id:uuid(10),status:'pending',request_reason:'Expediente de prueba pendiente de autorización, elaborado con antecedentes ficticios.',source_reference:'ARCHIVO V160 / TOMO 1',requested_at:'2026-10-22T15:00:00Z'},
{id:uuid(102),decree_id:uuid(202),note_id:uuid(302),diocese_id:uuid(1),parish_id:uuid(10),status:'authorized',request_reason:'Autorización ficticia de expediente documental, a ejecutar por Cancillería.',source_reference:'ARCHIVO V160 / TOMO 2',approval_reference:'AUTO FICTICIO V160 002',requested_at:'2026-10-22T16:00:00Z'},
{id:uuid(103),decree_id:uuid(203),note_id:uuid(303),diocese_id:uuid(1),parish_id:uuid(10),status:'rejected',request_reason:'La fuente documental necesita nuevas comprobaciones.',source_reference:'ARCHIVO V160 / TOMO 3',rejection_reference:'RECHAZO FICTICIO V160 003',rejection_reason:'Referencia documental insuficiente: se rechazó sin alterar partidas ni decretos.',requested_at:'2026-10-22T17:00:00Z'},
{id:uuid(104),decree_id:uuid(204),note_id:uuid(304),diocese_id:uuid(1),parish_id:uuid(10),status:'executed',request_reason:'Conciliación ficticia ejecutada con auditoría y notificación.',source_reference:'ARCHIVO V160 / TOMO 4',requested_at:'2026-10-22T18:00:00Z'}
];
window.__v160={role,history:[],records};
export default function DashboardLayout({children}){return <div className="min-h-screen bg-slate-100">
 <div className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-900">QA V160 AISLADA · {role.toUpperCase()} · DATOS TOTALMENTE FICTICIOS · SIN CONEXIÓN A SUPABASE</div>
 {children}
 </div>;}
export const useAuth=()=>({user:{role,dioceseId:uuid(1),chanceryId:uuid(2)}});
export const useToast=()=>({toast:x=>window.__v160.history.push({action:'toast',title:x.title})});
export async function institutionalConfirm(x){window.__v160.history.push({action:'confirm',title:x.title});return true;}
export const listLaterNoteReconciliations=async()=>records.map(x=>({...x}));
export const requestLaterNoteReconciliation=async p=>{
 window.__v160.history.push({action:'request',payload:p});
 records.push({id:uuid(105),decree_id:p.decreeId,note_id:p.noteId,diocese_id:uuid(1),status:'pending',request_reason:p.reason,source_reference:p.sourceReference,requested_at:new Date().toISOString()}); return uuid(105);};
export const approveLaterNoteReconciliation=async p=>{
 window.__v160.history.push({action:'approve',caseId:p.caseId});
 const x=records.find(r=>r.id===p.caseId); x.status='authorized';x.approval_reference=p.authorizationReference;return {status:'authorized'};};
export const rejectLaterNoteReconciliation=async p=>{
 window.__v160.history.push({action:'reject',caseId:p.caseId});
 const x=records.find(r=>r.id===p.caseId); x.status='rejected';x.rejection_reason=p.rejectionReason;x.rejection_reference=p.rejectionReference;return {status:'rejected'};};
export const executeLaterNoteReconciliation=async id=>{
 window.__v160.history.push({action:'execute',caseId:id});
 const x=records.find(r=>r.id===id);x.status='executed';return {status:'executed'};};
export const supabase={
 from(name){
  return {select(){
   const chain={
     eq(){return chain;},
     is(){return chain;},
     async maybeSingle(){return {data:name==='decretos'?{
       id:uuid(201),parish_id:uuid(10),replacement_record_id:uuid(40),sacrament_type:'matrimonio',status:'active'
     }:null,error:null};},
     async order(){return {data:name==='marginal_notes'?[{
       id:uuid(301),content:'Nota manual simulada anterior',note_date:'2026-10-21',
       source_type:'manual',note_type:'manual',is_locked:false,decree_id:null,status:'active',print_policy:'optional'
     }]:[],error:null};}
   };
   return chain;
  }};
 }
};
