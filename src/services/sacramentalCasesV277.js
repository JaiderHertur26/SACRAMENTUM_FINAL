import { supabase } from '@/lib/supabaseClient';
import { listSentMatrimonialNotifications } from '@/services/matrimonialNotificationsService';
import { validateSacramentalCase, summarizeSacramentalCase, classifyBaptismDestination } from '@/domain/sacramentalNotificationCasesV277.mjs';

const invalidStatus = new Set(['anulada','annulled','deleted','reversed','revertida','cancelled','replaced']);
const active = item => !invalidStatus.has(String(item.status||'').toLowerCase());

const marriagePerson = (raw,position) => {
  const male = position === 0;
  const first = male ? (raw.novioNombres || raw.nombr1) : (raw.noviaNombres || raw.nombr2);
  const last = male ? (raw.novioApellidos || raw.apell1) : (raw.noviaApellidos || raw.apell2);
  return [first,last].filter(Boolean).join(' ').trim();
};

export function ceremonyPeopleV277(record,sacrament) {
  if(sacrament==='confirmacion') return [{name:[record.nombres,record.apellidos].filter(Boolean).join(' ').trim(),role:'confirmando'}];
  const raw=record.raw_data||{};
  return [
    {name:marriagePerson(raw,0),role:'principal'},
    {name:marriagePerson(raw,1),role:'conyuge'}
  ];
}

export async function loadSacramentalCaseContextV277(parishId) {
  if(!parishId) throw new Error('Sesión parroquial incompleta');
  // V291: no consultar las primeras 300 partidas ni cargar padrones completos.
  // El selector invoca el buscador paginado del servidor por separado.
  const {data:destinations,error}=await supabase.rpc('list_sacramental_parish_destinations_v277');
  if(error) throw error;
  return {
    parishes:(destinations||[]).map(p=>({...p,dioceseName:p.dioceseName||'Diócesis'}))
  };
}

/**
 * V291: búsqueda real en servidor, paginada y restringida por auth.uid().
 * No acepta parishId para impedir consultas a otra parroquia.
 */
export async function searchCelebratedSacramentalRecordsV291({
  sacrament,query='',book='',folio='',number='',date='',page=0,limit=15
}={}) {
  if(!['matrimonio','confirmacion'].includes(sacrament))
    throw new Error('Sacramento no válido');
  if(!Number.isInteger(page)||page<0||page>13333)
    throw new Error('Página de resultados inválida');
  const {data,error}=await supabase.rpc('search_celebrated_sacramental_records_v291',{
    p_sacrament:sacrament,p_query:query.trim(),p_book:book.trim(),
    p_folio:folio.trim(),p_number:number.trim(),p_date:date||null,
    p_offset:page*limit,p_limit:limit
  });
  if(error)throw new Error(error.message||'No fue posible buscar partidas asentadas');
  if(!data||!Array.isArray(data.items))throw new Error('Respuesta de búsqueda inválida');
  return {items:data.items,total:Number(data.total)||0,hasMore:data.hasMore===true};
}

export async function issueSacramentalCaseV277({sacrament,sourceRecordId,senderParishId,parties}) {
  if(!sourceRecordId) throw new Error('Seleccione el registro sacramental asentado');
  const verified=validateSacramentalCase({sacrament,senderParishId,parties});
  const payload=verified.map(({type,requiresAcknowledgement,requiresExternalEvidence,manualCoordinatesVerified,...party})=>({
    ...party,
    parishId:party.parishId||null,
    baptismId:party.baptismId||null,
    locator:party.locator||{}
  }));
  const {data,error}=await supabase.rpc('issue_sacramental_case_v277',{
    p_sacrament:sacrament,p_source_record_id:sourceRecordId,p_parties:payload
  });
  if(error) throw error;
  if(!data?.notification_id) throw new Error('La emisión no devolvió un expediente identificable');
  return data;
}

export async function listExternalSacramentalReturnsV277() {
  const {data,error}=await supabase.rpc('list_external_sacramental_returns_v288');
  if(error) throw error;
  return Array.isArray(data)?data:[];
}

export async function recordExternalSacramentalReturnV277({id,reference,returnedAt,returnedVia,certified,file,notificationId,parishId}) {
  if(!id || !reference?.trim() || !returnedAt || !returnedVia?.trim() ||
    certified!==true || !file || !notificationId || !parishId)
    throw new Error('Adjunte la notificación ejecutada, fecha, referencia y certificación del asiento.');
  const extension=String(file.name||'').split('.').pop().toLowerCase();
  const permitted={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
  if(!permitted[extension] || file.type!==permitted[extension] || file.size>10485760 || file.size===0)
    throw new Error('La evidencia debe ser PDF, JPG o PNG y pesar hasta 10 MB.');
  const evidencePath=[parishId,notificationId,id,crypto.randomUUID()+'.'+extension].join('/');
  const {error:uploadError}=await supabase.storage.from('sacramental-return-evidence')
    .upload(evidencePath,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(uploadError)throw new Error('No se pudo adjuntar evidencia privada: '+uploadError.message);
  const {data,error}=await supabase.rpc('record_external_sacramental_return_v288',{
    p_delivery_id:id,p_evidence_reference:reference.trim(),p_returned_at:returnedAt,
    p_returned_via:returnedVia.trim(),p_confirmed_written:true,
    p_evidence_path:evidencePath
  });
  if(error)throw new Error('La evidencia fue cargada, pero no se confirmó la devolución: '+error.message);
  if(!data?.evidenceFilePath)throw new Error('No se confirmó el archivo de evidencia.');
  return data;
}

export async function getExternalEvidenceSignedUrlV288(path){
  if(!path)throw new Error('No existe archivo de evidencia');
  const {data,error}=await supabase.storage.from('sacramental-return-evidence')
    .createSignedUrl(path,120);
  if(error)throw error;
  return data.signedUrl;
}

export async function updatePhysicalLocatorV277({recipientId,book,folio,number,reference}) {
  const {data,error}=await supabase.rpc('update_sacramental_physical_locator_v277',{
    p_recipient_id:recipientId,p_book:book,p_folio:folio,p_number:number,p_reference:reference
  });
  if(error) throw error;
  return data;
}

export async function getSacramentalCaseDocumentV289(notificationId){
  if(!notificationId)throw new Error('No se identificó la notificación');
  const {data,error}=await supabase.rpc('get_sacramental_case_document_v289',{
    p_notification_id:notificationId
  });
  if(error)throw new Error(error.message||'No se pudo abrir el expediente compartido');
  if(data?.caseVersion!=='V277')throw new Error('Expediente sacramental no identificado');
  return reconcileCaseTrackingV277(data,data.externals||[]);
}

export function reconcileCaseTrackingV277(document,externals=[]) {
  const sourceParties=document.sourceParties||document.payload?.sourceParties||[];
  const recipients=document.recipientTracking||[];
  const relevant=externals.filter(e=>e.notificationId===document.id);
  const parties=sourceParties.map(p=>{
    const ext=relevant.find(e=>e.partyRole===p.role);
    if(ext) return {...p,type:'external',status:ext.status==='returned'?'processed':'pending',
      returnEvidenceVerified:ext.returnEvidenceVerified===true && Boolean(ext.evidenceFilePath),externalTrackingId:ext.id,
      evidenceFilePath:ext.evidenceFilePath,
      externalParishName:ext.destinationParish,externalDioceseName:ext.destinationDiocese,
      receiptReference:ext.evidenceReference,returnedAt:ext.returnedAt,returnedVia:ext.returnedVia};
    const recipient=recipients.find(r=>r.partyRole===p.role);
    if(!recipient) return {...p,status:'pending',type:'system_physical'};
    const type=classifyBaptismDestination({senderParishId:document.parishId,
      parishId:recipient.receiverParishId,baptismId:recipient.targetBaptismId});
    return {...p,type,status:recipient.status,noteApplied:Boolean(recipient.noteApplied),
      physicalNoteCertified:recipient.payload?.physicalNoteCertified===true,
      recipientId:recipient.id,receiverParishName:recipient.receiverParishName,
      receiptDocumentNumber:recipient.receiptDocumentNumber,acceptedAt:recipient.acceptedAt};
  });
  const summary=summarizeSacramentalCase(parties);
  return {...document,caseParties:parties,caseSummary:summary,
    documentReady:summary.readyToPrint && document.status==='processed'};
}

export async function listSentSacramentalCasesV277(parishId) {
  const [documents,externals]=await Promise.all([
    listSentMatrimonialNotifications(parishId),
    listExternalSacramentalReturnsV277()
  ]);
  return documents.filter(x=>x.caseVersion==='V277').map(x=>reconcileCaseTrackingV277(x,externals));
}
