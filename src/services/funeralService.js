import { supabase } from '@/lib/supabaseClient';

const firstRow = (data) => Array.isArray(data) ? (data[0] || null) : (data || null);

export const createPendingFuneralCloud = async ({ parishId, record }) => {
  const { data, error } = await supabase.rpc('create_pending_funeral', {
    p_parish_id: parishId,
    p_record: record
  });

  if (error) throw error;
  return firstRow(data);
};

export const seatFuneralRecordCloud = async ({ pendingId, formData }) => {
  const { data, error } = await supabase.rpc('seat_funeral_record', {
    p_form_data: formData || {},
    p_pending_id: pendingId || null
  });

  if (error) throw error;
  return firstRow(data);
};

export const saveFuneralParametersCloud = async ({ parishId, params }) => {
  const { data, error } = await supabase.rpc('save_funeral_parameters', {
    p_parish_id: parishId,
    p_params: params
  });

  if (error) throw error;
  return data;
};

export const searchBaptismsForFuneralCloud = async ({ parishId, query, limit = 20 }) => {
  if (!parishId) return [];
  const term = String(query || '').trim();
  if (term.length < 2) return [];

  let request = supabase
    .from('baptisms')
    .select('*')
    .eq('parish_id', parishId)
    .not('status', 'in', '("anulada","annulled","reversed","revertida","replaced","deleted")')
    .order('apellidos', { ascending: true })
    .order('nombres', { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit) || 20, 50)));

  const tokens = term
    .toUpperCase()
    .split(/\s+/)
    .map((value) => value.replace(/[%_,()]/g, '').trim())
    .filter((value) => value.length >= 2)
    .slice(0, 4);

  for (const token of tokens) {
    request = request.or(`nombres.ilike.%${token}%,apellidos.ilike.%${token}%,nuip.ilike.%${token}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data || [];
};

export const getFuneralParametersCloud = async (parishId) => {
  const { data, error } = await supabase
    .from('parish_parameters')
    .select('exequias_params')
    .eq('parish_id', parishId)
    .maybeSingle();

  if (error) throw error;
  return data?.exequias_params || null;
};

export const getPendingFuneralsCloud = async (parishId) => {
  const { data, error } = await supabase
    .from('pending_funerals')
    .select('id, parish_id, status, reportado, fecha_exequias, hora, numero_registro, book_type, raw_data, created_at, updated_at')
    .eq('parish_id', parishId)
    .eq('reportado', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getFuneralsCloud = async (parishId) => {
  const { data, error } = await supabase
    .from('funerals')
    .select('*')
    .eq('parish_id', parishId)
    .order('fecha_exequias', { ascending: false, nullsFirst: false })
    .order('fecha_defuncion', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getFuneralMarginalNotesCloud = async (funeralId) => {
  const { data, error } = await supabase
    .from('marginal_notes')
    .select('id, note_type, decree_number, content, note_date, created_at')
    .eq('sacrament_type', 'exequias')
    .eq('sacrament_id', funeralId)
    .order('note_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getFuneralInstitutionCloud = async ({ parishId, fallbackParish, fallbackDiocese, fallbackCity }) => {
  const result = {
    parishName: fallbackParish || 'PARROQUIA',
    dioceseName: fallbackDiocese || 'DIÓCESIS / ARQUIDIÓCESIS',
    city: fallbackCity || ''
  };

  if (!parishId) return result;

  const { data: parish, error: parishError } = await supabase
    .from('parishes')
    .select('name, city, diocese_id')
    .eq('id', parishId)
    .maybeSingle();

  if (!parishError && parish) {
    result.parishName = parish.name || result.parishName;
    result.city = parish.city || result.city;

    if (parish.diocese_id) {
      const { data: diocese, error: dioceseError } = await supabase
        .from('dioceses')
        .select('name')
        .eq('id', parish.diocese_id)
        .maybeSingle();

      if (!dioceseError && diocese?.name) {
        result.dioceseName = diocese.name;
      }
    }
  }

  return result;
};
