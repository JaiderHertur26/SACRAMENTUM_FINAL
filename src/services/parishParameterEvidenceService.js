import { supabase } from '@/lib/supabaseClient';
import { validateBoletaCounter, resolveBoletaCounterChange } from '@/domain/boletaCounterPolicy.mjs';
export { validateBoletaCounter };

// V256: the sole *proposed* manual parameter mutation. This RPC is not yet
// deployed; fail closed rather than falling back to legacy save_* endpoints.
// The database must separately revoke broad parameter mutation privileges.
export const REGISTRATION_COUNTER_COLUMNS = Object.freeze({
  bautismo: 'bautizos_params',
  confirmacion: 'confirmaciones_params',
  matrimonio: 'matrimonios_params',
  exequias: 'exequias_params'
});

export async function loadParishParameterEvidence(parishId, sacrament) {
  const column = REGISTRATION_COUNTER_COLUMNS[sacrament];
  if (!parishId || !column) throw new Error('La consulta requiere una parroquia y sacramento válidos.');
  const { data, error } = await supabase.from('parish_parameters')
    .select(column).eq('parish_id', parishId).maybeSingle();
  if (error) throw error;
  if (!data || !data[column] || typeof data[column] !== 'object' ||
      Array.isArray(data[column])) {
    throw new Error('No hay parámetros documentados en Supabase; no se mostrarán valores supuestos.');
  }
  return Object.freeze({ ...data[column] });
}

export async function saveBoletaCounter({ parishId, sacrament, expected, next }) {
  if (!parishId || !REGISTRATION_COUNTER_COLUMNS[sacrament]) {
    throw new Error('La modificación exige una parroquia y sacramento identificados.');
  }
  const validated = resolveBoletaCounterChange(expected, next);
  const { data, error } = await supabase.rpc('update_parish_boleta_counter_v256', {
    p_parish_id: parishId,
    p_sacrament: sacrament,
    p_expected: validated.expected,
    p_new_value: validated.next
  });
  if (error) throw new Error(
    /update_parish_boleta_counter_v256|schema cache|PGRST202/i.test(String(error.message || error.code))
      ? 'Aún no está habilitada la operación institucional exclusiva del contador de boletas.'
      : error.message
  );
  if (!data || typeof data !== 'object' || typeof data.numeroRegistroActual !== 'string') {
    throw new Error('El servidor no confirmó el valor guardado; vuelva a consultar antes de continuar.');
  }
  return data.numeroRegistroActual;
}
