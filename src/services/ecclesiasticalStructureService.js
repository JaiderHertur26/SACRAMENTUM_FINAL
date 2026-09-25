import { supabase } from '@/lib/supabaseClient';

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const throwIf = (result, context) => {
  if (result?.error) {
    const error = new Error(result.error.message || context);
    error.cause = result.error;
    throw error;
  }
  return result?.data;
};

export async function loadEcclesiasticalStructure(dioceseId, ownerAuthUserId = null) {
  if (!dioceseId) throw new Error('No se pudo determinar la jurisdicción activa.');

  const queries = [
    supabase.from('dioceses').select('id,name,type,city,bishop,bishop_name').eq('id', dioceseId).maybeSingle(),
    supabase.from('chancelleries').select('*').eq('diocese_id', dioceseId),
    supabase.from('vicarias').select('*').eq('diocese_id', dioceseId).order('name'),
    supabase.from('decanatos').select('*').eq('diocese_id', dioceseId).order('name'),
    supabase.from('parishes').select('*').eq('diocese_id', dioceseId).order('name'),
    supabase.from('user_profiles')
      .select('id,auth_user_id,email,username,full_name,role,status,is_active,diocese_id,parish_id,chancery_id')
      .eq('diocese_id', dioceseId),
  ];

  if (ownerAuthUserId) {
    queries.push(
      supabase.from('pending_tokens')
        .select('id,token,type,payload,created_by,created_at')
        .eq('created_by', ownerAuthUserId)
        .in('type', ['PARISH', 'CHANCERY'])
        .order('created_at', { ascending: false })
    );
  }

  const results = await Promise.all(queries);
  const [dioceseRes, chanceryRes, vicaryRes, deaneryRes, parishRes, profileRes, pendingRes] = results;

  const diocese = throwIf(dioceseRes, 'No fue posible cargar la jurisdicción.');
  const chancelleries = throwIf(chanceryRes, 'No fue posible cargar la Cancillería.') || [];
  const vicaries = throwIf(vicaryRes, 'No fue posible cargar las vicarías.') || [];
  const deaneries = throwIf(deaneryRes, 'No fue posible cargar los decanatos.') || [];
  const parishes = throwIf(parishRes, 'No fue posible cargar las parroquias.') || [];
  const profiles = throwIf(profileRes, 'No fue posible cargar los perfiles institucionales.') || [];
  const rawPending = pendingRes ? (throwIf(pendingRes, 'No fue posible cargar los códigos pendientes.') || []) : [];

  const pending = rawPending.map((item) => ({
    id: item.id,
    token: item.token,
    type: String(item.type || '').toUpperCase(),
    ...(item.payload || {}),
    created_by: item.created_by,
    created_at: item.created_at,
    date: item.created_at ? new Date(item.created_at).toLocaleDateString() : '',
  }));

  return {
    diocese,
    chancery: chancelleries[0] || null,
    chancelleries,
    vicaries,
    deaneries,
    parishes,
    profiles,
    pending,
  };
}

export async function createVicary({ dioceseId, name, vicarName }) {
  const result = await supabase.from('vicarias').insert([{
    diocese_id: dioceseId,
    name: clean(name),
    vicar_name: clean(vicarName),
  }]).select('*').single();
  return throwIf(result, 'No fue posible crear la vicaría.');
}

export async function createDeanery({ dioceseId, vicaryId, name, deanName }) {
  const result = await supabase.from('decanatos').insert([{
    diocese_id: dioceseId,
    vicaria_id: vicaryId,
    name: clean(name),
    dean_name: clean(deanName),
  }]).select('*').single();
  return throwIf(result, 'No fue posible crear el decanato.');
}

export async function updateVicary({ id, dioceseId, name, vicarName }) {
  const result = await supabase.from('vicarias').update({
    name: clean(name),
    vicar_name: clean(vicarName),
  }).eq('id', id).eq('diocese_id', dioceseId).select('*').single();
  return throwIf(result, 'No fue posible actualizar la vicaría.');
}

export async function updateDeanery({ id, dioceseId, vicaryId, name, deanName }) {
  const result = await supabase.from('decanatos').update({
    vicaria_id: vicaryId,
    name: clean(name),
    dean_name: clean(deanName),
  }).eq('id', id).eq('diocese_id', dioceseId).select('*').single();
  return throwIf(result, 'No fue posible actualizar el decanato.');
}

export async function updateParishTerritory({ id, dioceseId, name, city, priest, vicaryId, deaneryId }) {
  const result = await supabase.from('parishes').update({
    name: clean(name),
    city: clean(city),
    parroco: clean(priest),
    vicary_id: clean(vicaryId),
    decanate_id: clean(deaneryId),
  }).eq('id', id).eq('diocese_id', dioceseId).select('*').single();
  return throwIf(result, 'No fue posible actualizar la parroquia.');
}

export async function updateChancery({ id, dioceseId, name, city }) {
  const result = await supabase.from('chancelleries').update({
    name: clean(name),
    city: clean(city),
  }).eq('id', id).eq('diocese_id', dioceseId).select('*').single();
  return throwIf(result, 'No fue posible actualizar la Cancillería.');
}

async function removeScoped(table, id, dioceseId, context) {
  const result = await supabase.from(table).delete().eq('id', id).eq('diocese_id', dioceseId).select('id').maybeSingle();
  throwIf(result, context);
  if (!result.data) throw new Error('El registro no existe o está fuera de su jurisdicción.');
  return id;
}

export const deleteVicary = (id, dioceseId) => removeScoped('vicarias', id, dioceseId, 'No fue posible eliminar la vicaría.');
export const deleteDeanery = (id, dioceseId) => removeScoped('decanatos', id, dioceseId, 'No fue posible eliminar el decanato.');
export const deleteParish = (id, dioceseId) => removeScoped('parishes', id, dioceseId, 'No fue posible eliminar la parroquia.');
export const deleteChancery = (id, dioceseId) => removeScoped('chancelleries', id, dioceseId, 'No fue posible eliminar la Cancillería.');

export function profileForParish(profiles, parishId) {
  return (profiles || []).find((profile) => profile.parish_id === parishId && String(profile.role || '').toLowerCase() === 'parish') || null;
}

export function profileForChancery(profiles, chanceryId) {
  return (profiles || []).find((profile) => profile.chancery_id === chanceryId && String(profile.role || '').toLowerCase() === 'chancery') || null;
}
