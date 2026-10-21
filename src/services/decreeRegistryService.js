import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES, RECORD_TYPES, DECREE_TYPES } from '@/config/supabaseConfig';
import { decreeCategory, decreeSacrament } from '@/utils/decreeArchiveModel.mjs';

export const normalizeSacramentType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('confirm')) return RECORD_TYPES.CONFIRMATION;
  if (v.includes('matrim')) return RECORD_TYPES.MARRIAGE;
  if (v.includes('exequ') || v.includes('funer')) return RECORD_TYPES.FUNERAL;
  if (v.includes('baut') || v.includes('bapt')) return RECORD_TYPES.BAPTISM;
  return null;
};

export const normalizeDecreeType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('repos') || v.includes('replacement')) return DECREE_TYPES.REPLACEMENT;
  if (v.includes('correc')) return DECREE_TYPES.CORRECTION;
  if (v.includes('anul')) return DECREE_TYPES.ANNULMENT;
  if (decreeCategory(v) === 'documental') return 'documental';
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
// La consulta exige ámbito explícito, incluye expedientes legacy y recorre páginas.
// PostgREST limita las respuestas por defecto: nunca perder decretos > 1000.
export async function listDecrees({ parishIds = [], dioceseId = null, type = null, sacramentType = null } = {}) {
  if (!dioceseId && (!Array.isArray(parishIds) || parishIds.length === 0)) return [];
  const all = [];
  const PAGE_SIZE = 500;
  const MAX_PAGES = 200;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_SIZE;
    let query = supabase.from(TABLE_NAMES.DECREES).select('*');
    if (dioceseId) query = query.eq('diocese_id', dioceseId);
    else query = query.in('parish_id', parishIds);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) throw new Error('El archivo excede 100.000 decretos; refine el ámbito.');
  }
  const wanted = sacramentType ? decreeSacrament(sacramentType) : null;
  const kind = type ? decreeCategory(type) : null;
  return all.map(hydrateDecree).filter((row) =>
    (!wanted || decreeSacrament(row.sacramentType) === wanted)
    && (!kind || decreeCategory(row.tipo, row.payload) === kind)
  );
}

export async function attachDecreeConceptPolicy({ decreeId, conceptId }) {
  if (!decreeId || !conceptId) return false;
  const { data, error } = await supabase.rpc('attach_decree_concept_policy', {
    p_decree_id: decreeId,
    p_concept_id: conceptId
  });
  if (error) throw error;
  return data === true || Boolean(data);
}

export default {
  listDecrees,
  hydrateDecree,
  normalizeDecreeType,
  normalizeSacramentType,
  attachDecreeConceptPolicy
};
