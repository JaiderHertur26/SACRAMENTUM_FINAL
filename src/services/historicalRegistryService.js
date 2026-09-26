import { supabase } from '@/lib/supabaseClient';

const unwrap = (data) => Array.isArray(data) ? data[0] : data;
const rpcError = (error, name) => {
  const message = String(error?.message || error || '');
  if (message.includes(name) || message.includes('Could not find the function') || message.includes('schema cache')) {
    if (name === 'register_historical_narrative') {
      return new Error('Falta aplicar la migración V31 de asientos históricos narrativos en Supabase.');
    }
    return new Error('Falta aplicar la migración 20260904_009_historical_registry_imports.sql en Supabase.');
  }
  return error instanceof Error ? error : new Error(message || 'Error de Supabase');
};

const isNarrativeRecord = (record) => (
  String(record?.historicalEntryMode || record?.historical_entry_mode || '').toLowerCase() === 'narrative'
);

export async function registerHistoricalNarrative({ parishId, sacramentType, record }) {
  if (!parishId) throw new Error('No se pudo identificar la parroquia.');
  if (!String(record?.literalTranscription || record?.literal_transcription || '').trim()) {
    throw new Error('La Transcripción literal del asiento original es obligatoria.');
  }

  const { data, error } = await supabase.rpc('register_historical_narrative', {
    p_parish_id: parishId,
    p_sacrament_type: sacramentType,
    p_record: record
  });

  if (error) throw rpcError(error, 'register_historical_narrative');
  const row = unwrap(data);
  if (!row?.record_id) {
    throw new Error('Supabase no confirmó el identificador del asiento narrativo. No se reportará éxito.');
  }
  return row;
}

export async function registerHistoricalBaptism({ parishId, formData }) {
  if (isNarrativeRecord(formData)) {
    return registerHistoricalNarrative({
      parishId,
      sacramentType: 'bautismo',
      record: formData
    });
  }

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
  if (isNarrativeRecord(formData)) {
    return registerHistoricalNarrative({
      parishId,
      sacramentType: 'confirmacion',
      record: formData
    });
  }

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
  if (isNarrativeRecord(record)) {
    return registerHistoricalNarrative({
      parishId,
      sacramentType: 'matrimonio',
      record
    });
  }

  if (!parishId) throw new Error('No se pudo identificar la parroquia.');
  const { data, error } = await supabase.rpc('register_historical_marriage', {
    p_parish_id: parishId,
    p_record: record
  });
  if (error) throw rpcError(error, 'register_historical_marriage');
  return unwrap(data);
}
