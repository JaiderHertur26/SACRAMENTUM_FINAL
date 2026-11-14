import { supabase } from '@/lib/supabaseClient';

export async function getManualSeatContext(parishId, sacrament, pendingIds) {
  const { data, error } = await supabase.rpc('get_parish_seat_context_v328', {
    p_parish_id: parishId,
    p_sacrament: sacrament,
    p_pending_ids: pendingIds
  });
  if (error) throw error;
  return data;
}

export async function seatManually({ parishId, sacrament, records, context, coordinates }) {
  const { data, error } = await supabase.rpc('seat_parish_records_v328', {
    p_parish_id: parishId,
    p_sacrament: sacrament,
    p_records: records,
    p_context: context,
    p_coordinates: coordinates
  });
  if (error) throw error;
  return data;
}
