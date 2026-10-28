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
