import { supabase } from '@/lib/supabaseClient';
import { validateRepetitionDraft } from '@/utils/repetitionDecreePolicy.mjs';
export { SACRAMENTS, repetitionStatusLabel, validateRepetitionDraft } from '@/utils/repetitionDecreePolicy.mjs';

const rpc=async (name,params)=>{
 const {data,error}=await supabase.rpc(name,params);
 if(error)throw new Error(error.message||'No se completó la operación institucional');
 return data;
};
export async function issueRepetitionDecree(v){
 validateRepetitionDraft(v);
 const params={
  p_parish_id:v.parishId,p_sacrament:v.sacrament,p_concept_id:v.conceptId,
  p_number:v.number.trim(),p_date:v.date,p_target:v.target.trim(),
  p_reason:v.reason.trim(),p_evidence:v.evidence.trim(),
  p_instruction:v.instruction.trim(),p_signer:v.signer
 };
 if(v.caseMode==='duplicate_baptism_entries'){
  return rpc('issue_repetition_case_v314',{
    ...params,p_entries:v.affectedEntries.map(({parishId,parishName,external,externalJurisdiction,book,folio,number,recordId,disposition,justification})=>
      ({parishId,parishName,external:!!external,externalJurisdiction,book,folio,number,recordId,disposition,justification}))
  });
 }
 return rpc('issue_repetition_decree_v312',params);
}
export async function resolveParishRepetition({decreeId,resolution,evidence,observation,multiParish=false}){
 if(!['documented','needs_review'].includes(resolution)||String(observation||'').trim().length<15
  ||(resolution==='documented' && String(evidence||'').trim().length<8))
  throw Error('Registre el resultado, observación y evidencia documental');
 const params={p_decree_id:decreeId,p_resolution:resolution,
  p_evidence:String(evidence||'').trim(),p_observation:observation.trim()};
 if(multiParish)return rpc('resolve_repetition_parish_v314',params);
 return rpc('resolve_parish_repetition_v312',params);
}
export async function returnRepetitionToParish({decreeId,instruction,parishId,multiParish=false}){
 if(String(instruction||'').trim().length<15)throw Error('Escriba la aclaración para el párroco');
 if(multiParish){
  if(!parishId)throw Error('Seleccione la parroquia solicitante de la aclaración');
  return rpc('return_repetition_parish_v314',{
   p_decree_id:decreeId,p_parish_id:parishId,p_instruction:instruction.trim()
  });
 }
 return rpc('return_repetition_to_parish_v312',{p_decree_id:decreeId,p_instruction:instruction.trim()});
}
export async function registerRepetitionEntryMarginal({decreeId,entryIndex,method,evidence,observation}){
 if(!decreeId||!Number.isInteger(entryIndex)||entryIndex<1||!['digital','physical'].includes(method)
  ||String(evidence||'').trim().length<8||String(observation||'').trim().length<15)
  throw Error('Falta partida, modalidad, referencia u observación verificable');
 return rpc('register_repetition_entry_marginal_v315',{
  p_decree_id:decreeId,p_entry_index:entryIndex,p_method:method,
  p_evidence:String(evidence).trim(),p_observation:String(observation).trim()
 });
}
export async function registerExternalRepetitionConstancy({decreeId,externalKey,evidence,observation}){
 if(!decreeId||!externalKey||String(evidence||'').trim().length<8||String(observation||'').trim().length<15)
  throw Error('Referencia y observación verificable de la parroquia externa obligatorias');
 return rpc('register_external_repetition_constancy_v314',{
  p_decree_id:decreeId,p_external_key:externalKey,
  p_evidence:String(evidence).trim(),p_observation:String(observation).trim()
 });
}
export async function listRepetitionDecrees({dioceseId,parishId}){
 if(!dioceseId&&!parishId)return [];
 const {data,error}=await supabase.rpc('list_repetition_cases_v314');
 if(!error)return (data||[]).filter(row=>dioceseId?row.diocese_id===dioceseId:
  row.parish_id===parishId||(row.payload?.affectedEntries||[]).some(e=>e.parishId===parishId));
 // Una instalación V312 todavía puede consultar solamente los decretos tradicionales.
 // Cualquier error de autenticación/permisos debe mostrarse y no degradar el control.
 if(!String(error.message||'').includes('list_repetition_cases_v314'))throw error;
 const all=[];
 for(let start=0;start<100000;start+=500){
  let query=supabase.from('decretos').select('*').eq('tipo','repeticion');
  query=dioceseId?query.eq('diocese_id',dioceseId):query.eq('parish_id',parishId);
  const {data:batch,error:batchError}=await query.order('created_at',{ascending:false})
   .order('id',{ascending:false}).range(start,start+499);
  if(batchError)throw batchError;
  all.push(...(batch||[]));
  if(!batch||batch.length<500)return all;
 }
 throw Error('El archivo excede el límite de esta consulta');
}
