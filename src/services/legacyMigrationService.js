import { supabase } from '@/lib/supabaseClient';
import { analyzeLegacyRow, detectLegacyProfile, extractLegacyRows } from '@/config/legacyImportProfiles';

const unwrapRpc = (data) => Array.isArray(data) ? data[0] : data;

const arrayBufferToHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');

export async function sha256File(file) {
  if (!file) return '';
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return arrayBufferToHex(digest);
}

export async function parseLegacyJsonFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const rows = extractLegacyRows(parsed);
  const profileKey = detectLegacyProfile(file.name, rows);
  return { parsed, rows, profileKey };
}

export function analyzeLegacyRows(profileKey, rows) {
  return rows.map((row,index) => analyzeLegacyRow(profileKey,row,index));
}

export async function listLegacyImportProfiles() {
  const { data, error } = await supabase.from('legacy_import_profiles').select('*').eq('active',true).order('display_name');
  if (error) throw error;
  return data || [];
}

export async function listLegacyBatches({ dioceseId = null, limit = 50 } = {}) {
  let q = supabase.from('legacy_import_batches').select('*').order('created_at',{ascending:false}).limit(limit);
  if (dioceseId) q = q.eq('diocese_id',dioceseId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listLegacyRows(batchId, { status = null, limit = 200 } = {}) {
  let q = supabase.from('legacy_import_rows').select('*').eq('batch_id',batchId).order('row_number').limit(limit);
  if (status) q = q.eq('status',status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createLegacyBatch({ filename, profileKey, hash, sourceName, parishId = null, dioceseId = null, metadata = {} }) {
  if (!parishId) throw new Error('Toda importación histórica debe quedar ligada a una parroquia propietaria.');
  const { data, error } = await supabase.rpc('create_legacy_import_batch', {
    p_filename: filename,
    p_profile_key: profileKey,
    p_sha256: hash || null,
    p_source_name: sourceName || null,
    p_parish_id: parishId || null,
    p_diocese_id: dioceseId || null,
    p_metadata: metadata
  });
  if (error) throw error;
  return data;
}

const rowPayload = (row) => ({
  row_number: row.row_number,
  source_key: row.source_key,
  checksum: row.checksum || null,
  target_entity: row.target_entity,
  original_data: row.original_data,
  normalized_data: row.normalized_data,
  status: row.status,
  issue_codes: row.issue_codes || [],
  issue_details: row.issue_details || {}
});

export async function stageLegacyRows(batchId, rows, chunkSize = 200, onProgress = null, sourceScope = '') {
  let staged = 0;
  for (let i=0; i<rows.length; i+=chunkSize) {
    const chunk = rows.slice(i,i+chunkSize).map(row => rowPayload({ ...row, source_key: sourceScope ? `${sourceScope}|${row.source_key}` : row.source_key }));
    const { error } = await supabase.rpc('stage_legacy_import_rows',{ p_batch_id:batchId, p_rows:chunk });
    if (error) throw error;
    staged += chunk.length;
    onProgress?.({staged,total:rows.length});
  }
  return staged;
}

export async function reviewLegacyRow({ rowId, normalizedData, status, issueCodes = [], issueDetails = {} }) {
  const { error } = await supabase.rpc('review_legacy_import_row', {
    p_row_id: rowId,
    p_normalized_data: normalizedData,
    p_status: status,
    p_issue_codes: issueCodes,
    p_issue_details: issueDetails
  });
  if (error) throw error;
}

export async function applyLegacyBatch(batchId, { chunkSize = 250, onProgress = null, profileKey = null } = {}) {
  const batch = await getLegacyMigrationSummary(batchId);
  const effectiveProfile = String(profileKey || batch?.profile_key || '').toUpperCase();
  const rpcName = ['NTMAT001','NTMAT002'].includes(effectiveProfile)
    ? 'apply_legacy_marginal_note_batch'
    : 'apply_legacy_import_batch_v2';

  let totalImported = 0;
  let totalFailed = 0;
  let remaining = 1;
  while (remaining > 0) {
    const { data, error } = await supabase.rpc(rpcName,{ p_batch_id:batchId, p_limit:chunkSize });
    if (error) throw error;
    const result = unwrapRpc(data) || {};
    totalImported += Number(result.imported || 0);
    totalFailed += Number(result.failed || 0);
    remaining = Number(result.remaining || 0);
    onProgress?.({ imported: totalImported, failed: totalFailed, remaining });
    if (Number(result.imported || 0) === 0 && remaining > 0) break;
  }

  let noteReconciliation = null;
  if (['NTMAT001','NTMAT002','MATRIMON'].includes(effectiveProfile) && batch?.parish_id) {
    const { data, error } = await supabase.rpc('reconcile_legacy_matrimonial_notes', {
      p_parish_id: batch.parish_id
    });
    if (error) throw error;
    noteReconciliation = data || null;
  }

  const { data: materialized, error: materializeError } = await supabase.rpc(
    'materialize_auxiliary_catalog_batch',
    { p_batch_id: batchId }
  );
  if (materializeError && !String(materializeError.message || '').includes('profile')) {
    throw materializeError;
  }

  const { data: diocesesMaterialized, error: diocesesMaterializeError } = await supabase.rpc(
    'materialize_diocesis_catalog_batch',
    { p_batch_id: batchId }
  );
  if (diocesesMaterializeError && !String(diocesesMaterializeError.message || '').includes('profile')) {
    throw diocesesMaterializeError;
  }

  return {
    imported: totalImported,
    failed: totalFailed,
    remaining,
    materialized,
    diocesesMaterialized,
    noteReconciliation
  };
}

export async function loadParishesForMigration(dioceseId = null) {
  let q = supabase.from('parishes').select('id,name,diocese_id,city').order('name');
  if (dioceseId) q = q.eq('diocese_id',dioceseId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getLegacyMigrationSummary(batchId) {
  const { data: batch, error } = await supabase.from('legacy_import_batches').select('*').eq('id',batchId).single();
  if (error) throw error;
  return batch;
}
