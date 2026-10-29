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
 return rpc('issue_repetition_decree_v312',{
   p_parish_id:v.parishId,p_sacrament:v.sacrament,p_concept_id:v.conceptId,
   p_number:v.number.trim(),p_date:v.date,p_target:v.target.trim(),
   p_reason:v.reason.trim(),p_evidence:v.evidence.trim(),
   p_instruction:v.instruction.trim(),p_signer:v.signer
 });
}
export async function resolveParishRepetition({decreeId,resolution,evidence,observation}){
 if(!['documented','needs_review'].includes(resolution)||String(observation||'').trim().length<15
 ||(resolution==='documented' && String(evidence||'').trim().length<8))
 throw Error('Registre el resultado, observación y evidencia documental');
 return rpc('resolve_parish_repetition_v312',{
  p_decree_id:decreeId,p_resolution:resolution,
  p_evidence:String(evidence||'').trim(),p_observation:observation.trim()
 });
}
export async function returnRepetitionToParish({decreeId,instruction}){
 if(String(instruction||'').trim().length<15)throw Error('Escriba la aclaración para el párroco');
 return rpc('return_repetition_to_parish_v312',{
  p_decree_id:decreeId,p_instruction:instruction.trim()
 });
}
export async function listRepetitionDecrees({dioceseId,parishId}){
 if(!dioceseId&&!parishId)return [];
 const all=[];
 for(let start=0;start<100000;start+=500){
  let query=supabase.from('decretos').select('*').eq('tipo','repeticion');
  query=dioceseId?query.eq('diocese_id',dioceseId):query.eq('parish_id',parishId);
  const {data,error}=await query.order('created_at',{ascending:false})
   .order('id',{ascending:false}).range(start,start+499);
  if(error)throw error;
  all.push(...(data||[]));
  if(!data||data.length<500)return all;
 }
 throw Error('El archivo excede el límite de esta consulta');
}
