import { supabase } from '@/lib/supabaseClient';

export const SHARED_AUXILIARY_TABLES = Object.freeze([
  'diocesis', 'iglesias', 'obispos', 'bishop_tenures', 'ciudades'
]);
export const SHARED_CATALOG_CHANGED = 'sacramentum:shared-catalog-changed';
const PAGE_SIZE = 500;
const ensureShared = (table) => {
  if (!SHARED_AUXILIARY_TABLES.includes(table)) throw new Error('El catálogo no es compartido.');
};

// La jurisdicción se resuelve en la base; el UUID que llega del formulario no
// autoriza acceso. RLS vuelve a validar la identidad, el rol y la parroquia.
export async function resolveAuxiliaryDiocese(contextId) {
  if (!contextId) throw new Error('No se identificó la parroquia o diócesis.');
  const parish = await supabase.from('parishes').select('diocese_id').eq('id', contextId).maybeSingle();
  if (parish.error) throw parish.error;
  if (parish.data?.diocese_id) return parish.data.diocese_id;
  const diocese = await supabase.from('dioceses').select('id').eq('id', contextId).maybeSingle();
  if (diocese.error) throw diocese.error;
  if (!diocese.data?.id) throw new Error('No se pudo resolver la diócesis del catálogo.');
  return diocese.data.id;
}

const normalize = (table, row) => table === 'obispos'
  ? { ...row, fechaNombramiento: row.fecha_nombramiento || '' }
  : table === 'ciudades' ? { ...row, createdAt: row.created_at || '' } : row;

export async function readSharedAuxiliaryCatalog(table, contextId) {
  ensureShared(table);
  const dioceseId = await resolveAuxiliaryDiocese(contextId);
  const rows = [];
  // Los catálogos ya superan 1.000 filas: no depender del límite de la API.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*')
      .eq('diocese_id', dioceseId).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []).map((row) => normalize(table, row)));
    if (!data || data.length < PAGE_SIZE) break;
  }
  rows.sort((a, b) => String(a.nombre || a.bishop_name || '').localeCompare(String(b.nombre || b.bishop_name || ''), 'es'));
  // Compatibilidad con los formularios existentes, siempre hidratada desde el
  // catálogo común. Nunca se usa un caché global sin jurisdicción.
  localStorage.setItem(`${table}_${contextId}`, JSON.stringify(rows));
  return rows;
}

function changed(table, dioceseId) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SHARED_CATALOG_CHANGED, {
    detail: { table, dioceseId }
  }));
}

export async function writeSharedAuxiliaryCatalog(table, contextId, values, id = null) {
  ensureShared(table);
  try {
    const dioceseId = await resolveAuxiliaryDiocese(contextId);
    const { parish_id: _parish, context_id: _context, diocese_id: _diocese, ...fields } = values;
    const origin = table === 'ciudades' ? 'context_id' : 'parish_id';
    const query = id
      ? supabase.from(table).update(fields).eq('id', id).eq('diocese_id', dioceseId)
      : supabase.from(table).insert({ ...fields, [origin]: contextId, diocese_id: dioceseId });
    const result = await query.select('*').single();
    if (!result.error) changed(table, dioceseId);
    return result;
  } catch (error) { return { data: null, error }; }
}

export async function deleteSharedAuxiliaryCatalog(table, contextId, id) {
  ensureShared(table);
  try {
    const dioceseId = await resolveAuxiliaryDiocese(contextId);
    const result = await supabase.from(table).delete().eq('id', id)
      .eq('diocese_id', dioceseId).select('id').single();
    if (!result.error) changed(table, dioceseId);
    return result;
  } catch (error) { return { data: null, error }; }
}

const identity = (table, row) => String(table === 'iglesias'
  ? row.codigo || row.nombre
  : table === 'obispos' ? `${row.nombre || ''} ${row.apellido || ''}` : row.nombre || '')
  .trim().toLocaleLowerCase('es');

export async function importSharedAuxiliaryCatalog(table, contextId, input) {
  ensureShared(table);
  try {
    const dioceseId = await resolveAuxiliaryDiocese(contextId);
    const existing = await readSharedAuxiliaryCatalog(table, contextId);
    const known = new Set(existing.map((row) => identity(table, row)));
    const origin = table === 'ciudades' ? 'context_id' : 'parish_id';
    const rows = input.filter((row) => {
      const key = identity(table, row);
      if (!key || known.has(key)) return false;
      known.add(key);
      return true;
    }).map((row) => ({ ...row, [origin]: contextId, diocese_id: dioceseId }));
    let imported = 0;
    for (let offset = 0; offset < rows.length; offset += 200) {
      const chunk = rows.slice(offset, offset + 200);
      const { error } = await supabase.from(table).insert(chunk);
      if (error) return { error, imported, skipped: input.length - rows.length };
      imported += chunk.length;
      changed(table, dioceseId);
    }
    await readSharedAuxiliaryCatalog(table, contextId);
    return { error: null, imported, skipped: input.length - rows.length };
  } catch (error) { return { error, imported: 0 }; }
}
