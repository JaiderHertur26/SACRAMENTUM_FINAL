import { supabase } from '@/lib/supabaseClient';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const lower = (value) => clean(value).toLowerCase();
const sameName = (a, b) => upper(a).replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '') === upper(b).replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '');

const normalizeChurch = (row = {}) => ({
  iglesia_id: row.iglesia_id || row.id || '',
  idcod: upper(row.idcod || row.codigo),
  nombre: upper(row.nombre),
  nronit: upper(row.nronit || row.nit),
  direccion: upper(row.direccion),
  ciudad: upper(row.ciudad),
  telefono: upper(row.telefono),
  nrofax: upper(row.nrofax || row.fax),
  email: lower(row.email),
  parroco: upper(row.parroco),
  diocesis: upper(row.diocesis)
});

const bestName = (profile) => upper(
  profile?.full_name || profile?.username || profile?.email || ''
);

export async function loadMisDatosAutofillContext(parishId) {
  if (!parishId) return { defaults: {}, churches: [] };

  const { data: parish, error: parishError } = await supabase
    .from('parishes')
    .select('*')
    .eq('id', parishId)
    .maybeSingle();

  if (parishError) throw parishError;
  if (!parish) return { defaults: {}, churches: [] };

  const [churchesResult, dioceseResult, vicaryResult, decanateResult, priestResult] = await Promise.all([
    supabase.from('iglesias').select('*').eq('parish_id', parishId).order('nombre'),
    parish.diocese_id
      ? supabase.from('dioceses').select('*').eq('id', parish.diocese_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    parish.vicary_id
      ? supabase.from('vicarias').select('id,name').eq('id', parish.vicary_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    parish.decanate_id
      ? supabase.from('decanatos').select('id,name').eq('id', parish.decanate_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('parrocos')
      .select('id,nombre,apellido,estado,fecha_ingreso,fecha_salida,email,telefono')
      .eq('parish_id', parishId)
      .order('fecha_ingreso', { ascending: false, nullsFirst: false })
      .limit(1)
  ]);

  for (const result of [churchesResult, dioceseResult, vicaryResult, decanateResult, priestResult]) {
    if (result?.error) throw result.error;
  }

  const diocese = dioceseResult.data || null;
  const currentPriest = priestResult.data?.[0] || null;
  let chancellorName = '';

  if (parish.diocese_id) {
    const { data: chancery, error: chanceryError } = await supabase
      .from('chancelleries')
      .select('id')
      .eq('diocese_id', parish.diocese_id)
      .maybeSingle();

    if (chanceryError) {
      console.warn('No fue posible resolver Cancillería para Mis Datos:', chanceryError);
    }

    if (chancery?.id) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name,username,email,is_active')
        .eq('chancery_id', chancery.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (profileError) {
        console.warn('No fue posible resolver el usuario Canciller para Mis Datos:', profileError);
      } else {
        chancellorName = bestName(profile);
      }
    }
  }

  const churches = (churchesResult.data || []).map(normalizeChurch);
  const matchingChurch = churches.find((item) => sameName(item.nombre, parish.name));
  const priestName = upper([currentPriest?.nombre, currentPriest?.apellido].filter(Boolean).join(' '));

  const institutionalDefaults = {
    iglesia_id: matchingChurch?.iglesia_id || '',
    idcod: matchingChurch?.idcod || '',
    nombre: upper(parish.name),
    nronit: matchingChurch?.nronit || upper(parish.nit),
    direccion: matchingChurch?.direccion || upper(parish.address),
    ciudad: matchingChurch?.ciudad || upper(parish.city),
    telefono: matchingChurch?.telefono || upper(parish.phone),
    nrofax: matchingChurch?.nrofax || '',
    email: matchingChurch?.email || '',
    parroco: matchingChurch?.parroco || priestName || upper(parish.parroco),
    diocesis: upper(diocese?.name) || matchingChurch?.diocesis || '',
    vicaria: upper(vicaryResult.data?.name),
    decanato: upper(decanateResult.data?.name),
    obispo: upper(diocese?.bishop_name || diocese?.bishop),
    canciller: chancellorName,
    region: upper(diocese?.jurisdiccion_eclesiastica || diocese?.provincia_eclesiastica),
    serial: '',
    ruta: ''
  };

  return {
    defaults: institutionalDefaults,
    churches,
    parish: {
      id: parish.id,
      name: upper(parish.name)
    }
  };
}

export function mergeChurchIntoMisDatos(current = {}, church = {}, institutionalDefaults = {}) {
  const linked = normalizeChurch(church);
  return {
    ...current,
    iglesia_id: linked.iglesia_id || '',
    idcod: linked.idcod || current.idcod || '',
    nombre: linked.nombre || institutionalDefaults.nombre || current.nombre || '',
    nronit: linked.nronit || institutionalDefaults.nronit || current.nronit || '',
    direccion: linked.direccion || institutionalDefaults.direccion || current.direccion || '',
    ciudad: linked.ciudad || institutionalDefaults.ciudad || current.ciudad || '',
    telefono: linked.telefono || institutionalDefaults.telefono || current.telefono || '',
    nrofax: linked.nrofax || institutionalDefaults.nrofax || current.nrofax || '',
    email: linked.email || institutionalDefaults.email || current.email || '',
    parroco: linked.parroco || institutionalDefaults.parroco || current.parroco || '',
    diocesis: institutionalDefaults.diocesis || current.diocesis || linked.diocesis || '',
    vicaria: institutionalDefaults.vicaria || current.vicaria || '',
    decanato: institutionalDefaults.decanato || current.decanato || '',
    obispo: institutionalDefaults.obispo || current.obispo || '',
    canciller: institutionalDefaults.canciller || current.canciller || '',
    region: institutionalDefaults.region || current.region || ''
  };
}
