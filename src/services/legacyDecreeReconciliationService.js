import { supabase } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 200;
const MAX_PAGES = 100;

export function classifyHistoricalCase(row = {}) {
  const original = row.original_data || {};
  const state = String(row.reconciliation_status || 'archived').toLowerCase();
  const reason = row.metadata?.decree_reconciliation_v118
    || row.metadata?.decree_reconciliation_v68 || '';
  return {
    id: row.id,
    originId: row.source_origin_id || null,
    sourceKey: row.source_key || '',
    status: state,
    reason: String(reason || ''),
    decreeNumber: String(original.decreto || '').trim(),
    historicalDate: original.fecha || original.fechanul || null,
    location: [original.libro, original.folio, original.numero].filter((v) => v !== null && v !== undefined && v !== '').join(' / '),
    replacementLocation: [original.newlib, original.newfol, original.newnum].filter((v) => v !== null && v !== undefined && v !== '').join(' / '),
    sourceHash: row.source_sha256 || '',
    linkedDecreeId: row.metadata?.decree_id || null
  };
}

export async function listHistoricalDecreeCases() {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase.from('legacy_archive_records')
      .select('id,source_origin_id,source_sha256,source_key,reconciliation_status,original_data,metadata,created_at')
      .eq('profile_key', 'ANULACION')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return all.map(classifyHistoricalCase);
  }
  throw new Error('El archivo histórico supera el máximo de consulta. No se truncaron resultados en silencio.');
}

export async function listHistoricalOrigins(originIds) {
  const ids = [...new Set((originIds || []).filter((id) => UUID.test(String(id))))];
  const map = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('legacy_source_origins')
      .select('id,display_name,legacy_parish_name,mapped_parish_id,identity_status')
      .in('id', ids.slice(i, i + 100));
    if (error) throw error;
    for (const source of data || []) {
      map[source.id] = source;
    }
  }
  return map;
}

export async function reconcileHistoricalOrigin(originId) {
  if (!UUID.test(String(originId || ''))) {
    throw new Error('El origen histórico seleccionado no tiene un identificador válido.');
  }
  const { data, error } = await supabase.rpc('materialize_legacy_decrees_v68', {
    p_origin_id: originId,
    p_limit: 1000
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') {
    throw new Error('Cancillería no recibió una constancia verificable de conciliación.');
  }
  return {
    materialized: Number(data.materialized || 0),
    reviewRequired: Number(data.review_required || 0),
    skipped: Number(data.skipped || 0)
  };
}
