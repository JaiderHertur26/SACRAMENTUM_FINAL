import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES, RECORD_TYPES } from '@/config/supabaseConfig';

export const normalizeSacramentType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('confirm')) return RECORD_TYPES.CONFIRMATION;
  if (v.includes('matrim')) return RECORD_TYPES.MARRIAGE;
  if (v.includes('exequ') || v.includes('funer')) return RECORD_TYPES.FUNERAL;
  return RECORD_TYPES.BAPTISM;
};

// Consulta canónica del archivo de decretos. La emisión/modificación se realiza
// exclusivamente por RPC transaccionales de Cancillería/Diócesis.
export async function listDecrees({ parishIds = [], type = null, sacramentType = null } = {}) {
  let query = supabase.from(TABLE_NAMES.DECREES).select('*').order('created_at', { ascending: false });
  if (parishIds.length) query = query.in('parish_id', parishIds);
  if (type) query = query.eq('tipo', type);
  const { data, error } = await query;
  if (error) throw error;
  const wanted = sacramentType ? normalizeSacramentType(sacramentType) : null;
  return (data || []).filter((d) => !wanted || normalizeSacramentType(d.sacrament_type || d.payload?.sacramentType || d.payload?.sacramento) === wanted);
}
