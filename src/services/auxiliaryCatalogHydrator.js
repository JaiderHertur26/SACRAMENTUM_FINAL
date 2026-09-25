import { supabase } from '@/lib/supabaseClient';

const safePayload = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const cache = (key, value) => {
  localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
};

export const refreshAuxiliaryCatalogCaches = async (activeUser) => {
  const parishId = activeUser?.parishId || activeUser?.parish_id || null;
  const dioceseId = activeUser?.dioceseId || activeUser?.diocese_id || null;
  const contextId = parishId || dioceseId || null;
  if (!contextId) return { success: true, refreshed: 0 };

  const queryByParish = (table) => parishId
    ? supabase.from(table).select('*').eq('parish_id', parishId)
    : Promise.resolve({ data: [], error: null });

  const [parrocosRes, iglesiasRes, obisposRes, diocesisRes, ciudadesRes] = await Promise.all([
    queryByParish('parrocos'),
    queryByParish('iglesias'),
    queryByParish('obispos'),
    queryByParish('diocesis'),
    supabase.from('ciudades').select('*').eq('context_id', contextId),
  ]);

  let refreshed = 0;

  if (parishId && !parrocosRes.error && Array.isArray(parrocosRes.data)) {
    const rows = parrocosRes.data.map((row) => {
      const p = safePayload(row.payload);
      return {
        ...p,
        id: row.id,
        nombre: p.nombre || row.nombre || '',
        apellido: p.apellido || row.apellido || '',
        email: p.email || row.email || '',
        telefono: p.telefono || row.telefono || '',
        fechaIngreso: p.fechaIngreso || p.fechaNombramiento || row.fecha_ingreso || '',
        fechaNombramiento: p.fechaNombramiento || p.fechaIngreso || row.fecha_ingreso || '',
        fechaSalida: p.fechaSalida || row.fecha_salida || '',
        estado: p.estado || row.estado || '',
      };
    });
    cache(`parrocos_${parishId}`, rows);
    refreshed += 1;
  }

  if (parishId && !iglesiasRes.error && Array.isArray(iglesiasRes.data)) {
    const rows = iglesiasRes.data.map((row) => ({
      ...row,
      nronit: row.nronit || row.nit || '',
      nrofax: row.nrofax || row.fax || '',
    }));
    cache(`iglesias_${parishId}`, rows);
    refreshed += 1;
  }

  if (parishId && !obisposRes.error && Array.isArray(obisposRes.data)) {
    const rows = obisposRes.data.map((row) => ({
      ...row,
      fechaNombramiento: row.fechaNombramiento || row.fecha_nombramiento || '',
    }));
    cache(`obispos_${parishId}`, rows);
    refreshed += 1;
  }

  if (parishId && !diocesisRes.error && Array.isArray(diocesisRes.data)) {
    cache(`diocesis_${parishId}`, diocesisRes.data);
    refreshed += 1;
  }

  if (!ciudadesRes.error && Array.isArray(ciudadesRes.data)) {
    const rows = ciudadesRes.data.map((row) => ({
      ...row,
      createdAt: row.createdAt || row.created_at || '',
    }));
    cache(`ciudades_${contextId}`, rows);
    refreshed += 1;
  }

  return { success: true, refreshed };
};
