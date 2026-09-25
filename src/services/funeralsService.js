import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES } from '@/config/supabaseConfig';

const clean = (v) => (v === '' || v === undefined ? null : v);

export async function listFunerals(parishId) {
  if (!parishId) return [];
  const { data, error } = await supabase
    .from(TABLE_NAMES.FUNERALS)
    .select('*')
    .eq('parish_id', parishId)
    .order('fecha_exequias', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listPendingFunerals(parishId) {
  if (!parishId) return [];
  const { data, error } = await supabase
    .from(TABLE_NAMES.PENDING_FUNERALS)
    .select('*')
    .eq('parish_id', parishId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function savePendingFuneral({ parishId, formData }) {
  const payload = {
    parish_id: parishId,
    fecha_exequias: clean(formData.fecha_exequias),
    hora: clean(formData.hora_exequias),
    status: 'pending',
    raw_data: formData
  };
  const { data, error } = await supabase.from(TABLE_NAMES.PENDING_FUNERALS).insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function seatFuneralRecord({ formData, pendingId = null }) {
  const { data, error } = await supabase.rpc('seat_funeral_record', {
    p_form_data: formData,
    p_pending_id: pendingId
  });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('seat_funeral_record') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración profesional de Exequias en Supabase antes de asentar registros.');
    }
    throw error;
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function listFuneralsForDiocese(dioceseId) {
  const { data: parishes, error: pError } = await supabase.from(TABLE_NAMES.PARISHES).select('id,name').eq('diocese_id', dioceseId);
  if (pError) throw pError;
  const parishIds = (parishes || []).map((p) => p.id);
  if (!parishIds.length) return [];
  const names = new Map((parishes || []).map((p) => [p.id, p.name]));
  const { data, error } = await supabase.from(TABLE_NAMES.FUNERALS).select('*').in('parish_id', parishIds).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, parish_name: names.get(r.parish_id) || '' }));
}

export async function deletePendingFuneral(id, parishId) {
  const { error } = await supabase.from(TABLE_NAMES.PENDING_FUNERALS).delete().eq('id', id).eq('parish_id', parishId);
  if (error) throw error;
}

export async function getFuneralParameters(parishId) {
  const { data, error } = await supabase
    .from(TABLE_NAMES.PARISH_PARAMETERS)
    .select('exequias_params,bautizos_params,confirmaciones_params,matrimonios_params')
    .eq('parish_id', parishId)
    .maybeSingle();
  if (error) throw error;
  return data?.exequias_params || { libro: 1, folio: 1, numero: 1, partidasPorFolio: 2, reiniciarNumeroEnFolio: false };
}

export async function updateFuneralParameters(parishId, exequiasParams) {
  const { data: existing, error: readError } = await supabase
    .from(TABLE_NAMES.PARISH_PARAMETERS)
    .select('id')
    .eq('parish_id', parishId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { error } = await supabase.from(TABLE_NAMES.PARISH_PARAMETERS).update({ exequias_params: exequiasParams }).eq('parish_id', parishId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(TABLE_NAMES.PARISH_PARAMETERS).insert({
    parish_id: parishId,
    bautizos_params: {},
    confirmaciones_params: {},
    matrimonios_params: {},
    exequias_params: exequiasParams
  });
  if (error) throw error;
}

const rpcFirstRow = (data) => (Array.isArray(data) ? (data[0] || null) : data);

export async function applyFuneralCorrectionDecree({
  funeralId,
  decreeDate,
  reason,
  changes,
  decreeNumber = null
}) {
  const { data, error } = await supabase.rpc('apply_funeral_correction', {
    p_funeral_id: funeralId,
    p_decree_date: decreeDate,
    p_reason: reason,
    p_changes: changes,
    p_decree_number: decreeNumber || null
  });

  if (error) throw error;
  return rpcFirstRow(data);
}

export async function createFuneralRepositionByDecree({
  parishId,
  decreeDate,
  reason,
  record,
  evidence,
  decreeNumber = null
}) {
  const { data, error } = await supabase.rpc('create_funeral_reposition_by_decree', {
    p_parish_id: parishId,
    p_decree_date: decreeDate,
    p_reason: reason,
    p_record: record,
    p_evidence: evidence,
    p_decree_number: decreeNumber || null
  });

  if (error) throw error;
  return rpcFirstRow(data);
}

export async function reverseFuneralDecree({
  decreeId,
  reason = null
}) {
  const { data, error } = await supabase.rpc('reverse_funeral_decree', {
    p_decree_id: decreeId,
    p_reason: reason || null
  });

  if (error) throw error;
  return rpcFirstRow(data);
}

