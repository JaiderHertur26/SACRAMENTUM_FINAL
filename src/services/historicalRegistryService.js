import { supabase } from '@/lib/supabaseClient';

const unwrap = (data) => Array.isArray(data) ? data[0] : data;
const rpcError = (error, name) => {
  const message = String(error?.message || error || '');
  if (message.includes(name) || message.includes('Could not find the function') || message.includes('schema cache')) {
    return new Error('Falta aplicar la migración 20260904_009_historical_registry_imports.sql en Supabase.');
  }
  return error instanceof Error ? error : new Error(message || 'Error de Supabase');
};

export async function registerHistoricalBaptism({ parishId, formData }) {
  if (!parishId) throw new Error('No se pudo identificar la parroquia.');
  const { data, error } = await supabase.rpc('register_historical_baptism', {
    p_parish_id: parishId,
    p_record: formData
  });
  if (error) throw rpcError(error, 'register_historical_baptism');
  const row = unwrap(data);
  if (!row?.record_id) {
    throw new Error('Supabase no confirmó el identificador de la partida histórica. No se reportará éxito.');
  }
  return row;
}

export async function registerHistoricalConfirmation({ parishId, formData, crossBaptismId = null, crossNote = null }) {
  if (!parishId) throw new Error('No se pudo identificar la parroquia.');
  const { data, error } = await supabase.rpc('register_historical_confirmation', {
    p_parish_id: parishId,
    p_record: formData,
    p_cross_baptism_id: crossBaptismId,
    p_cross_note: crossNote
  });
  if (error) throw rpcError(error, 'register_historical_confirmation');
  const row = unwrap(data);
  if (!row?.record_id) {
    throw new Error('Supabase no confirmó el identificador de la Confirmación histórica. No se reportará éxito.');
  }
  return row;
}

export async function registerHistoricalMarriage({ parishId, record }) {
  if (!parishId) throw new Error('No se pudo identificar la parroquia.');
  const { data, error } = await supabase.rpc('register_historical_marriage', {
    p_parish_id: parishId,
    p_record: record
  });
  if (error) throw rpcError(error, 'register_historical_marriage');
  return unwrap(data);
}
