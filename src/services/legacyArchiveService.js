import { supabase } from '@/lib/supabaseClient';

export async function loadLegacyArchiveSummary() {
  const { data, error } = await supabase.rpc('legacy_archive_summary_v43');
  if (error) throw error;
  return data || { total: 0, byProfile: {}, byStatus: {} };
}

export async function listLegacyArchiveRecords({
  dioceseId = null,
  parishId = null,
  profileKey = '',
  search = '',
  limit = 250,
} = {}) {
  let q = supabase
    .from('legacy_archive_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dioceseId) q = q.eq('diocese_id', dioceseId);
  if (parishId) q = q.eq('parish_id', parishId);
  if (profileKey) q = q.eq('profile_key', profileKey);

  const { data, error } = await q;
  if (error) throw error;

  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return data || [];
  return (data || []).filter((row) => {
    const haystack = JSON.stringify({
      source_key: row.source_key,
      profile_key: row.profile_key,
      target_entity: row.target_entity,
      original_data: row.original_data,
      normalized_data: row.normalized_data,
      metadata: row.metadata,
    }).toLowerCase();
    return haystack.includes(needle);
  });
}

export async function listLegacyReportDefinitions({ category = '', status = '', limit = 500 } = {}) {
  let q = supabase
    .from('legacy_report_definitions')
    .select('*')
    .order('category')
    .order('report_key')
    .limit(limit);
  if (category) q = q.eq('category', category);
  if (status) q = q.eq('audit_status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listLegacySourceInstallations({ dioceseId = null, limit = 200 } = {}) {
  let q = supabase
    .from('legacy_source_installations')
    .select('*')
    .order('created_at', { ascending:false })
    .limit(limit);
  if (dioceseId) q = q.eq('owner_diocese_id', dioceseId);
  const { data,error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listLegacySourceFiles({ installationId = null, limit = 500 } = {}) {
  let q = supabase
    .from('legacy_source_files')
    .select('*')
    .order('created_at', { ascending:false })
    .limit(limit);
  if (installationId) q = q.eq('source_installation_id', installationId);
  const { data,error } = await q;
  if (error) throw error;
  return data || [];
}
