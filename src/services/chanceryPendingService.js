import { supabase } from '@/lib/supabaseClient';

const parseObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return {};
};

const clean = (value) => String(value ?? '').trim();
const joinName = (...parts) => parts.map(clean).filter(Boolean).join(' ').trim();

const resolveMarriageName = (raw) => {
  const groom = joinName(
    raw.groomName ?? raw.novioNombres ?? raw.esposo?.nombres ?? raw.nombres_esposo,
    raw.groomSurname ?? raw.novioApellidos ?? raw.esposo?.apellidos ?? raw.apellidos_esposo,
  );
  const bride = joinName(
    raw.brideName ?? raw.noviaNombres ?? raw.esposa?.nombres ?? raw.nombres_esposa,
    raw.brideSurname ?? raw.noviaApellidos ?? raw.esposa?.apellidos ?? raw.apellidos_esposa,
  );
  return [groom, bride].filter(Boolean).join(' / ') || 'Expediente matrimonial';
};

const resolvePersonName = (type, raw) => {
  if (type === 'Matrimonio') return resolveMarriageName(raw);
  return joinName(
    raw.nombres ?? raw.firstName ?? raw.nombre,
    raw.apellidos ?? raw.lastName ?? raw.apellido,
  ) || (type === 'Exequias' ? 'Difunto sin nombre disponible' : 'Registro sin nombre disponible');
};

const resolveSacramentDate = (type, raw, row) => {
  if (type === 'Matrimonio') {
    return row.celebration_date || raw.fechaMatrimonio || raw.sacramentDate || raw.fechaSacramento || clean(raw.fechaHoraPrevista).slice(0, 10);
  }
  if (type === 'Exequias') {
    return row.fecha_exequias || raw.fechaExequias || raw.fecha_exequias || raw.fechaSacramento || raw.sacramentDate;
  }
  return row.celebration_date || raw.fechaSacramento || raw.sacramentDate || raw.celebration_date;
};

export const resolveChanceryDioceseId = async (user) => {
  let dioceseId = user?.dioceseId || user?.diocese_id || null;
  if (dioceseId) return dioceseId;

  const chanceryId = user?.chanceryId || user?.chancery_id || null;
  if (!chanceryId) return null;

  const { data, error } = await supabase
    .from('chancelleries')
    .select('diocese_id')
    .eq('id', chanceryId)
    .maybeSingle();

  if (error) throw error;
  return data?.diocese_id || null;
};

export const loadChanceryPendingSacraments = async (user) => {
  const dioceseId = await resolveChanceryDioceseId(user);
  if (!dioceseId) return { dioceseId: null, rows: [] };

  const { data: parishes, error: parishError } = await supabase
    .from('parishes')
    .select('id,name')
    .eq('diocese_id', dioceseId)
    .order('name', { ascending: true });

  if (parishError) throw parishError;

  const parishRows = Array.isArray(parishes) ? parishes : [];
  const parishIds = parishRows.map((row) => row.id).filter(Boolean);
  const parishNames = new Map(parishRows.map((row) => [row.id, row.name || 'Parroquia']));

  if (!parishIds.length) return { dioceseId, rows: [] };

  const specs = [
    { table: 'pending_baptisms', type: 'Bautismo' },
    { table: 'pending_confirmations', type: 'Confirmación' },
    { table: 'pending_marriages', type: 'Matrimonio' },
    { table: 'pending_funerals', type: 'Exequias' },
  ];

  const groups = await Promise.all(specs.map(async ({ table, type }) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('parish_id', parishIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn(`No fue posible cargar ${table}:`, error);
      return [];
    }

    return (data || []).map((row) => {
      const raw = parseObject(row.raw_data);
      return {
        id: row.id,
        parishId: row.parish_id,
        parishName: parishNames.get(row.parish_id) || 'Parroquia',
        sacramentType: type,
        personName: resolvePersonName(type, raw),
        sacramentDate: resolveSacramentDate(type, raw, row) || '',
        registrationNumber: raw.numeroRegistro || raw.numero_registro || row.numero_registro || '',
        createdAt: row.created_at || '',
        status: row.status || 'pending',
        raw,
      };
    });
  }));

  const rows = groups.flat().sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return { dioceseId, rows };
};
