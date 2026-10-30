import { validateAffectedEntries } from './repetitionCaseV314.mjs';
export const SACRAMENTS=Object.freeze({bautismo:'Bautismo',confirmacion:'Confirmación',matrimonio:'Matrimonio',exequias:'Exequias'});
export const repetitionStatusLabel=(v)=>({awaiting_parish:'Pendiente en parroquia',awaiting_parishes:'Pendiente de constancias parroquiales',needs_chancery_review:'Aclaración solicitada a Cancillería',completed_documentary:'Constancia registrada · expediente completo'})[v]||'Sin actuación registrada';
export const isRepetitionDecree=(r={})=>String(r.tipo||r.payload?.decreeType||'').toLowerCase()==='repeticion';
export const canParishResolveRepetition=(r={})=>isRepetitionDecree(r)&&r.status==='active'&&r.payload?.recordOrigin==='chancery_repetition_v312'&&r.payload?.repetitionWorkflowStatus==='awaiting_parish';
export const canChanceryReturnRepetition=(r={})=>isRepetitionDecree(r)&&r.status==='active'&&r.payload?.recordOrigin==='chancery_repetition_v312'&&r.payload?.repetitionWorkflowStatus==='needs_chancery_review';
export function validateRepetitionDraft(v={},today=new Date().toISOString().slice(0,10)){
 const len=(t)=>String(t||'').trim().length;
 if(!v.parishId||!SACRAMENTS[v.sacrament]||!v.conceptId||!['canciller','vicecanciller'].includes(v.signer)||len(v.number)<4||len(v.number)>80||! /^\d{4}-\d{2}-\d{2}$/.test(String(v.date||''))||v.date>today||len(v.target)<4||len(v.target)>300||len(v.reason)<20||len(v.reason)>4000||len(v.evidence)<8||len(v.evidence)>1000||len(v.instruction)<15||len(v.instruction)>4000)throw Error('Complete la expedición de Repetición');
 if(v.caseMode==='duplicate_baptism_entries'){
  if(v.sacrament!=='bautismo')throw Error('Duplicidad registral habilitada únicamente para Bautismo');
  validateAffectedEntries(v.affectedEntries,v.parishId);
 }
 return true;
}
