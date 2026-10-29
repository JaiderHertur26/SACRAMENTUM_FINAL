import {supabase} from '@/lib/supabaseClient';
import {nameFromCorrectedRecord} from '@/utils/decreeCorrectedName.mjs';

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
  // El nombre persistido debe ser el corregido, no el nombre de la búsqueda original.
  const correctedTargetName=nameFromCorrectedRecord(record,sacrament)||targetName.trim();
  for(const key of [
    'Libro','libro','book','book_number','bookNumber','folio','page','page_number',
    'number','entry','entry_number','numero','numeroPartida',
    'seatBook','seatFolio','seatNumber','newPartidaSummary','location','ubicacion',
    'numero_registro','numeroRegistro','status','estado'
  ])delete record[key];
  // La autoridad se elige en todos los formularios que usan este servicio.
  const {chooseDecreeSignerV294}=await import('@/components/chancery/DecreeSignerPickerV294');
  const signerOffice=await chooseDecreeSignerV294();
  if(!signerOffice)throw new Error('Expedición cancelada: seleccione quién da fe del decreto.');
  const {data,error}=await supabase.rpc('issue_chancery_form_decree_v294',{
    p_parish_id:parishId,
    p_sacrament:sacrament,
    p_decree_type:type,
    p_original_record_id:type==='correccion'?originalRecordId:null,
    p_concept_id:conceptId,
    p_decree_number:decreeNumber.trim(),
    p_decree_date:decreeDate,
    p_target_name:correctedTargetName,
    p_reason:reason.trim(),
    p_evidence_ref:String(evidenceRef||('PARTIDA-'+originalRecordId)).trim(),
    p_new_record:record,
    p_details:details,
    p_signer_office:signerOffice
  });
  if(error)throw new Error(error.message||'No se pudo expedir el decreto sin asiento');
  if(data?.status!=='awaiting_parish'||!data?.decreeId||
     data?.book!=null||data?.folio!=null||data?.number!=null){
    throw new Error('No se verificó la emisión sin Libro, Folio ni Número. Consulte el expediente.');
  }
  return data;
}
