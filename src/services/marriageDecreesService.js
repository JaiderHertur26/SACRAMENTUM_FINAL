import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES } from '@/config/supabaseConfig';
import { mapMarriageRow } from '@/services/marriagesCloudService';

const firstRow = (data) => Array.isArray(data) ? (data[0] || null) : data;

export async function listMarriagesForDiocese(dioceseId) {
  const { data: parishes, error: parishError } = await supabase
    .from(TABLE_NAMES.PARISHES)
    .select('id,name,city')
    .eq('diocese_id', dioceseId)
    .order('name');
  if (parishError) throw parishError;

  const ids = (parishes || []).map((p) => p.id);
  if (!ids.length) return [];

  const names = new Map((parishes || []).map((p) => [p.id, p.name]));
  const { data, error } = await supabase
    .from(TABLE_NAMES.MARRIAGES)
    .select('*')
    .in('parish_id', ids)
    .or('status.is.null,status.neq.deleted')
    .order('celebration_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({ ...mapMarriageRow(row), raw_data: row.raw_data || {}, parish_name: names.get(row.parish_id) || '' }));
}

export async function getMarriageDecreeParameters(parishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.PARISH_PARAMETERS)
    .select('matrimonios_params')
    .eq('parish_id', parishId)
    .maybeSingle();
  if (error) throw error;
  return data?.matrimonios_params || {};
}

export async function applyMarriageCorrectionDecree({ marriageId, decreeDate, reason, changes, decreeNumber = null }) {
  const { data, error } = await supabase.rpc('apply_marriage_correction', {
    p_marriage_id: marriageId,
    p_decree_date: decreeDate,
    p_reason: reason,
    p_changes: changes,
    p_decree_number: decreeNumber || null
  });
  if (error) throw error;
  return firstRow(data);
}

export async function createMarriageRepositionDecree({ parishId, decreeDate, reason, record, evidence, decreeNumber = null }) {
  const { data, error } = await supabase.rpc('create_marriage_reposition_by_decree', {
    p_parish_id: parishId,
    p_decree_date: decreeDate,
    p_reason: reason,
    p_record: record,
    p_evidence: evidence,
    p_decree_number: decreeNumber || null
  });
  if (error) throw error;
  return firstRow(data);
}

export async function reverseMarriageDecree({ decreeId, reason }) {
  const { data, error } = await supabase.rpc('reverse_marriage_decree', {
    p_decree_id: decreeId,
    p_reason: reason
  });
  if (error) throw error;
  return firstRow(data);
}
