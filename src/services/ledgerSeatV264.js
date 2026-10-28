import { supabase } from '@/lib/supabaseClient';
import { ledgerV264Enabled, prepareLedgerSeatRequestV264 } from '@/domain/ledgerSeatV264.mjs';

export async function getLedgerSeatContextV264({parishId,sacrament,pendingIds=[]}) {
  if (!ledgerV264Enabled) throw Error('Cambio institucional V264 todavía no activado.');
  const {data,error}=await supabase.rpc('get_parish_ledger_seat_context_v264',{
    p_parish_id:parishId,p_sacrament:sacrament,p_pending_ids:pendingIds
  });
  if (error) throw Error('No fue posible verificar libros y constancias en el servidor. No se permite asentar. '+error.message);
  if (!data || data.parishId!==parishId || data.sacrament!==sacrament ||
      !Array.isArray(data.books) || !Array.isArray(data.boletas)) {
    throw Error('Respuesta de memoria institucional incompleta. No se permite asentar.');
  }
  return data;
}
export async function seatWithLedgerV264(args) {
  const {name,payload}=prepareLedgerSeatRequestV264(args);
  const {data,error}=await supabase.rpc(name,payload);
  if (error) throw error;
  if (!data || !Array.isArray(data.seats) ||
      data.seats.length!==payload.p_pending_ids.length ||
      !data.seats.every(x=>x.book && x.folio && x.number && x.seat_id)) {
    throw Error('Resultado de asiento no verificable. Recargue antes de intentar otra operación.');
  }
  return data;
}

export async function attestNewCelebrationV265({parishId,sacrament,pendingId,evidenceRef}) {
  if (!ledgerV264Enabled) throw Error('La comprobación de celebraciones todavía no está habilitada.');
  const evidence=String(evidenceRef||'').trim();
  if (!parishId || !pendingId || !['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament) ||
      evidence.length<8 || evidence.length>120) {
    throw Error('Es obligatorio identificar el registro y su comprobante institucional.');
  }
  const {data,error}=await supabase.rpc('attest_new_celebration_v265',{
    p_parish_id:parishId,p_sacrament:sacrament,p_pending_id:pendingId,p_evidence_ref:evidence
  });
  if(error)throw error;
  if(data?.pending_id!==pendingId || data?.sacrament!==sacrament ||
     data?.evidence_ref!==evidence || !data?.verified_at){
    throw Error('No se pudo verificar el comprobante de celebración en servidor.');
  }
  return data;
}

export async function openFirstOfficialBookV267({
  parishId,sacrament,pendingId,bookCode,firstFolio,firstNumber,
  capacity,restartNumberEachFolio
}) {
  if(!ledgerV264Enabled)throw Error('La apertura oficial de libros no está activada.');
  const code=String(bookCode||'').trim();
  const number=x=>{
    const v=String(x??'').trim();
    if(!/^[0-9]{1,10}$/.test(v)||!Number.isSafeInteger(Number(v))
      ||Number(v)<1||Number(v)>2147483647)
      throw Error('Folio, Número y capacidad deben ser enteros positivos válidos.');
    return Number(v);
  };
  if(!parishId||!pendingId||!['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament)
    ||!/^[A-Za-z0-9]{1,32}$/.test(code)
    ||typeof restartNumberEachFolio!=='boolean')
    throw Error('Identificación o código del primer libro inválidos.');
  const folio=number(firstFolio),partida=number(firstNumber),perFolio=number(capacity);
  if(perFolio>200)throw Error('La capacidad máxima admitida es 200 partidas por folio.');
  const {data,error}=await supabase.rpc('open_first_official_book_v267',{
    p_parish_id:parishId,p_sacrament:sacrament,p_pending_id:pendingId,
    p_book_code:code,p_first_folio:folio,p_first_partida:partida,
    p_partidas_per_folio:perFolio,p_restart_number_each_folio:restartNumberEachFolio
  });
  if(error)throw error;
  if(!data?.bookId||data.bookCode!==code||Number(data.nextFolio)!==folio
     ||Number(data.nextNumber)!==partida)
    throw Error('El servidor no confirmó una apertura coincidente. Consulte antes de repetir.');
  return data;
}

export async function openNextOfficialBookV270({
 parishId,sacrament,previousBookId,expectedVersion,pendingId,
 bookCode,firstFolio,firstNumber,capacity,restartNumberEachFolio,closeEvidenceRef
}) {
 if(!ledgerV264Enabled) throw Error('La sucesión oficial aún no está activada.');
 const code=String(bookCode||'').trim(),evidence=String(closeEvidenceRef||'').trim();
 const positive=x=>{const s=String(x??'').trim();
   if(!/^[0-9]{1,10}$/.test(s)||Number(s)<1||Number(s)>2147483647)
     throw Error('Los números de Libro deben ser enteros positivos.');
   return Number(s);
 };
 if(!parishId||!previousBookId||!pendingId||
  !['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament)||
  !/^[A-Za-z0-9]{1,32}$/.test(code)||
  !Number.isSafeInteger(Number(expectedVersion))||Number(expectedVersion)<0||
  ![true,false].includes(restartNumberEachFolio)||
  evidence.length<8||evidence.length>120)
  throw Error('Debe identificar el libro anterior y aportar constancia de cierre.');
 const folio=positive(firstFolio),number=positive(firstNumber),perFolio=positive(capacity);
 if(perFolio>200)throw Error('La capacidad máxima permitida es 200 partidas por folio.');
 const {data,error}=await supabase.rpc('open_next_official_book_v270',{
  p_parish_id:parishId,p_sacrament:sacrament,
  p_previous_book_id:previousBookId,p_expected_version:Number(expectedVersion),
  p_pending_id:pendingId,p_new_book_code:code,p_first_folio:folio,
  p_first_partida:number,p_partidas_per_folio:perFolio,
  p_restart_number_each_folio:restartNumberEachFolio,p_close_evidence_ref:evidence
 });
 if(error)throw error;
 if(!data?.bookId||data.bookCode!==code||data.previousBookId!==previousBookId||
  Number(data.nextFolio)!==folio||Number(data.nextNumber)!==number)
  throw Error('El servidor no confirmó la sucesión exacta. Consulte antes de repetir.');
 return data;
}

export async function openFirstSupplementaryBookV271(args) {
 if(!ledgerV264Enabled)throw Error('El libro supletorio aún no está habilitado.');
 const {parishId,sacrament,pendingId,bookCode,firstFolio,firstNumber,capacity,
 restartNumberEachFolio}=args;
 const code=String(bookCode||'').trim();
 const positive=value=>{const s=String(value??'').trim();
   if(!/^[0-9]{1,10}$/.test(s)||Number(s)<1||Number(s)>2147483647)
     throw Error('Libro supletorio: Folio, Número o capacidad inválidos.');
   return Number(s);
 };
 if(!parishId||!pendingId||!['bautismo','confirmacion','matrimonio','exequias'].includes(sacrament)
  ||!/^[A-Za-z0-9]{1,32}$/.test(code)
  ||typeof restartNumberEachFolio!=='boolean')
   throw Error('Identificación del libro supletorio inválida.');
 const folio=positive(firstFolio),number=positive(firstNumber),perFolio=positive(capacity);
 if(perFolio>200)throw Error('Máximo 200 partidas por folio.');
 const {data,error}=await supabase.rpc('open_first_supplementary_book_v271',{
  p_parish_id:parishId,p_sacrament:sacrament,p_pending_id:pendingId,
  p_book_code:code,p_first_folio:folio,p_first_partida:number,
  p_partidas_per_folio:perFolio,p_restart_number_each_folio:restartNumberEachFolio
 });
 if(error)throw error;
 if(!data?.bookId||data.bookCode!==code||Number(data.nextFolio)!==folio||
   Number(data.nextNumber)!==number)throw Error('El servidor no confirmó el libro supletorio.');
 return data;
}
