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

export async function loadMisDatosAutofillContext(parishId) {
  if (!parishId) return { defaults: {}, churches: [] };

  const { data: parish, error: parishError } = await supabase
    .from('parishes')
    .select('*')
    .eq('id', parishId)
    .maybeSingle();

  if (parishError) throw parishError;
  if (!parish) return { defaults: {}, churches: [] };

  const [churchesResult, dioceseResult, vicaryResult, decanateResult, priestResult, chanceryResult] = await Promise.all([
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
      .limit(1),
    parish.diocese_id
      ? supabase
          .from('chancelleries')
          .select('id,chancellor_name,vice_chancellor_name')
          .eq('diocese_id', parish.diocese_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  for (const result of [churchesResult, dioceseResult, vicaryResult, decanateResult, priestResult, chanceryResult]) {
    if (result?.error) throw result.error;
  }

  const diocese = dioceseResult.data || null;
  const currentPriest = priestResult.data?.[0] || null;
  const chancery = chanceryResult.data || null;
  const chancellorName = upper(chancery?.chancellor_name);
  const viceChancellorName = upper(chancery?.vice_chancellor_name);

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
    obispoAuxiliar: upper(diocese?.auxiliary_bishop),
    canciller: chancellorName,
    viceCanciller: viceChancellorName,
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
    obispoAuxiliar: institutionalDefaults.obispoAuxiliar || current.obispoAuxiliar || current.obispo_auxiliar || '',
    canciller: institutionalDefaults.canciller || current.canciller || '',
    viceCanciller: institutionalDefaults.viceCanciller || current.viceCanciller || current.vice_canciller || current.vicecanciller || '',
    region: institutionalDefaults.region || current.region || ''
  };
}
