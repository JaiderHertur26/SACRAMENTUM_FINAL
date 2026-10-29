import {supabase} from '@/lib/supabaseClient';

const request=async (name,params={})=>{
 const {data,error}=await supabase.rpc(name,params);
 if(error)throw new Error(error.message||'No se pudo concluir la operación institucional');
 return data;
};
export const listParishDecreeQueueV280=()=>request('get_parish_decree_queue_v280');
export const getParishDecreeBooksV280=decreeId=>request('get_parish_decree_books_v280',{p_decree_id:decreeId});
export const getChanceryDecreeIssueContextV280=(parishId,sacrament)=>request(
 'get_chancery_decree_issue_context_v280',{p_parish_id:parishId,p_sacrament:sacrament});
export const listChanceryDecreeReceiptsV280=()=>request('get_chancery_decree_receipts_v280');
export const markChanceryDecreeReceiptReadV280=decreeId=>request(
 'mark_chancery_decree_receipt_read_v280',{p_decree_id:decreeId});

export function validateIssuedDecreeV280({parishId,sacrament,pendingId,originalRecordId,type,
 conceptId,decreeNumber,decreeDate,targetName,reason,evidenceRef}){
 const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
 if(!uuid.test(parishId)||!uuid.test(pendingId)||!uuid.test(conceptId)||
 !['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament)||
 !['correccion','reposicion'].includes(type)||
 (type==='correccion'&&!uuid.test(originalRecordId))||
 (type==='reposicion'&&originalRecordId)||
 !decreeDate||decreeDate>new Date().toISOString().slice(0,10)||
 String(decreeNumber||'').trim().length<4||
 String(targetName||'').trim().length<4||
 String(reason||'').trim().length<15||
 String(evidenceRef||'').trim().length<8) {
  throw new Error('Decreto incompleto, sin partida original obligatoria o con concepto inválido');
 }
 return true;
}

export async function issueChanceryDecreeV280(args){
 validateIssuedDecreeV280(args);
 const {parishId,sacrament,pendingId,originalRecordId,type,conceptId,
  decreeNumber,decreeDate,targetName,reason,evidenceRef}=args;
 return request('issue_chancery_decree_v280',{
  p_parish_id:parishId,p_sacrament:sacrament,p_pending_id:pendingId,
  p_original_record_id:originalRecordId||null,p_decree_type:type,p_concept_id:conceptId,
  p_decree_number:decreeNumber.trim(),p_decree_date:decreeDate,
  p_target_name:targetName.trim(),p_reason:reason.trim(),p_evidence_ref:evidenceRef.trim()
 });
}

export function validateSeatDecreeV280({
 decreeId,bookCode,bookId,folio,number,capacity,restart,expectedVersion,operationId,context
}){
 if(!/^[A-Za-z0-9]{1,32}$/.test(String(bookCode||'').trim())||
 !/^[0-9a-f-]{36}$/i.test(String(decreeId||''))||
 !/^[0-9a-f-]{36}$/i.test(String(operationId||''))||
 !Number.isInteger(+folio)||+folio<1||+folio>2147483647||
 !Number.isInteger(+number)||+number<1||+number>2147483647||
 !Number.isInteger(+capacity)||+capacity<1||+capacity>200||
 !Number.isSafeInteger(+expectedVersion)||+expectedVersion<0||
 typeof restart!=='boolean')throw new Error('Libro, Folio, Número y partidas por folio inválidos');
 const existing=(context?.books||[]).find(x=>x.id===bookId);
 if(bookId && (!existing || String(bookCode).trim()!==existing.bookCode ||
 +folio!==+existing.nextFolio || +number!==+existing.nextNumber ||
 +capacity!==+existing.partidasPorFolio || restart!==existing.restartEachFolio ||
 +expectedVersion!==+existing.version)){
  throw new Error('Secuencia o capacidad distinta de la memoria irrevocable del libro');
 }
 if(!bookId && (context?.books||[]).length>0)
 throw new Error('Existe un libro abierto; debe utilizar su secuencia');
 if(!bookId && +expectedVersion!==0)throw new Error('Nuevo libro debe empezar con versión cero');
 return true;
}
export async function seatChanceryDecreeV280(args){
 validateSeatDecreeV280(args);
 return request('seat_chancery_decree_v280',{
  p_decree_id:args.decreeId,p_book_code:String(args.bookCode).trim().toUpperCase(),
  p_book_id:args.bookId||null,p_folio:+args.folio,p_number:+args.number,
  p_partidas_per_folio:+args.capacity,p_restart_number_each_folio:args.restart,
  p_expected_version:+args.expectedVersion,p_operation_id:args.operationId
 });
}
