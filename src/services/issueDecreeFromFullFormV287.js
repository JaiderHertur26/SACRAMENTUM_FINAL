import {supabase} from '@/lib/supabaseClient';

/**
 * V287: conserva el formulario y sus datos; Cancillería no elige, predice
 * ni consume coordenadas físicas de la partida nueva.
 * El motor V280 crea el decreto pendiente; la parroquia lo sienta después.
 */
export async function issueDecreeFromFullFormV287({
  parishId,sacrament,type,originalRecordId,conceptId,decreeNumber,decreeDate,
  targetName,reason,evidenceRef,newRecord,details={}
}){
  if(!parishId||!conceptId||!decreeNumber?.trim()||!decreeDate||
     !['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament)||
     !['correccion','reposicion'].includes(type)||
     !reason?.trim()||!targetName?.trim()){
    throw new Error('Complete la parroquia, concepto, número y fecha del decreto y su fundamento.');
  }
  const record={...newRecord};
  for(const key of [
    'Libro','libro','book','book_number','bookNumber','folio','page','page_number',
    'number','entry','entry_number','numero','numeroPartida',
    'seatBook','seatFolio','seatNumber','newPartidaSummary','location','ubicacion',
    'numero_registro','numeroRegistro','status','estado'
  ])delete record[key];
  const {data,error}=await supabase.rpc('issue_chancery_form_decree_v287',{
    p_parish_id:parishId,
    p_sacrament:sacrament,
    p_decree_type:type,
    p_original_record_id:type==='correccion'?originalRecordId:null,
    p_concept_id:conceptId,
    p_decree_number:decreeNumber.trim(),
    p_decree_date:decreeDate,
    p_target_name:targetName.trim(),
    p_reason:reason.trim(),
    p_evidence_ref:String(evidenceRef||('PARTIDA-'+originalRecordId)).trim(),
    p_new_record:record,
    p_details:details
  });
  if(error)throw new Error(error.message||'No se pudo expedir el decreto sin asiento');
  if(data?.status!=='awaiting_parish'||!data?.decreeId||
     data?.book!=null||data?.folio!=null||data?.number!=null){
    throw new Error('No se verificó la emisión sin Libro, Folio ni Número. Consulte el expediente.');
  }
  return data;
}
