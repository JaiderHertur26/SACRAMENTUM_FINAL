import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES, RECORD_TYPES, DECREE_TYPES } from '@/config/supabaseConfig';

export const normalizeSacramentType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('confirm')) return RECORD_TYPES.CONFIRMATION;
  if (v.includes('matrim')) return RECORD_TYPES.MARRIAGE;
  if (v.includes('exequ') || v.includes('funer')) return RECORD_TYPES.FUNERAL;
  return RECORD_TYPES.BAPTISM;
};

export const normalizeDecreeType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('repos') || v.includes('replacement')) return DECREE_TYPES.REPLACEMENT;
  if (v.includes('correc')) return DECREE_TYPES.CORRECTION;
  if (v.includes('anul')) return DECREE_TYPES.ANNULMENT;
  return v;
};

export const hydrateDecree = (row = {}) => {
  let payload = row.payload || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }

  return {
    ...row,
    payload,
    decreeType: normalizeDecreeType(row.tipo || payload.decreeType || payload.decretoType || payload.tipo),
    sacramentType: normalizeSacramentType(
      row.sacrament_type || payload.sacramentType || payload.sacramento || payload.sacrament
    ),
    decreeNumber: row.decree_number || payload.decreeNumber || payload.numeroDecreto || '',
    decreeDate: row.decree_date || payload.decreeDate || payload.fechaDecreto || '',
    targetName:
      payload.targetName ||
      payload.newTargetName ||
      [payload.nombres, payload.apellidos].filter(Boolean).join(' ') ||
      payload.originalPartidaSummary?.name ||
      payload.newPartidaSummary?.name ||
      '',
    originalLocation:
      payload.originalLocation ||
      payload.originalPartidaSummary ||
      payload.originalRecordSummary ||
      {},
    replacementLocation:
      payload.replacementLocation ||
      payload.newPartidaSummary ||
      payload.newRecordSummary ||
      payload.datosNuevaPartida ||
      {},
    status: row.status || payload.status || 'active'
  };
};

// Consulta canónica del archivo de decretos.
// La emisión/reversión jurídica se realiza exclusivamente por RPC de Cancillería/Diócesis.
export async function listDecrees({ parishIds = [], type = null, sacramentType = null } = {}) {
  let query = supabase
    .from(TABLE_NAMES.DECREES)
    .select('*')
    .order('created_at', { ascending: false });

  if (parishIds.length) query = query.in('parish_id', parishIds);
  if (type) query = query.eq('tipo', normalizeDecreeType(type));

  const { data, error } = await query;
  if (error) throw error;

  const wanted = sacramentType ? normalizeSacramentType(sacramentType) : null;
  return (data || [])
    .map(hydrateDecree)
    .filter((row) => !wanted || row.sacramentType === wanted);
}

export default {
  listDecrees,
  hydrateDecree,
  normalizeDecreeType,
  normalizeSacramentType
};
