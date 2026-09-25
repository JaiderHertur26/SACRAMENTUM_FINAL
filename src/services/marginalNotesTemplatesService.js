import { supabase } from '@/lib/supabaseClient';
import { getResolvedMarginalTemplates } from '@/services/marginalNotesV2Service';

export const DEFAULT_MARGINAL_NOTE_TEMPLATES = Object.freeze({
    correccion_anulada: 'PARTIDA ANULADA POR DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE LA [OFICINA_EXPIDE]. LA INFORMACIÓN CORREGIDA PASA AL L-[LIBRO_NUEVA] F-[FOLIO_NUEVA] N-[NUMERO_NUEVA].',
    correccion_nueva: 'ESTA PARTIDA SE INSCRIBE POR DECRETO DE CORRECCIÓN NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO], Y ANULA LA PARTIDA ORIGINAL DEL L-[LIBRO_ANULADA] F-[FOLIO_ANULADA] N-[NUMERO_ANULADA]. DA FE: [MINISTRO].',
    reposicion_nueva: 'ESTA PARTIDA SE INSCRIBE POR REPOSICIÓN SEGÚN DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO] DE LA [OFICINA_EXPIDE], DEBIDO A PÉRDIDA O DETERIORO DEL ORIGINAL. DA FE: [MINISTRO].',
    error_transcripcion: 'SE CORRIGE ERROR DE TRANSCRIPCIÓN. DONDE DECÍA: [VALOR_INCORRECTO], DEBE LEERSE CORRECTAMENTE COMO: [VALOR_CORRECTO]. DA FE: [MINISTRO].',
    bautismo_confirmado: 'EL [FECHA_CONFIRMACION] FUE CONFIRMADO(A) EN LA PARROQUIA [PARROQUIA_CONFIRMACION]. DIÓCESIS DE [DIOCESIS_CONFIRMACION]. L-[LIBRO_CONF], F-[FOLIO_CONF], N-[NUMERO_CONF].',
    bautismo_casado: 'EL [FECHA_NOTIFICACION] SE NOTIFICA QUE CONTRAJO MATRIMONIO CON [NOMBRE_CONYUGE] EL [FECHA_MATRIMONIO] EN LA PARROQUIA [PARROQUIA_MATRIMONIO]. DIÓCESIS: [DIOCESIS_MATRIMONIO]. L-[LIBRO_MAT], F-[FOLIO_MAT], N-[NUMERO_MAT].',
    bautismo_nulidad_mat: 'MATRIMONIO CON [NOMBRE_CONYUGE] DECLARADO NULO. SENTENCIA DEL TRIBUNAL ECLESIÁSTICO, DECRETO NO. [NUMERO_DECRETO] DEL [FECHA_DECRETO].',
    bautismo_orden: 'RECIBIÓ EL ORDEN SACERDOTAL / PROFESIÓN RELIGIOSA EL [FECHA_ORDEN] EN [LUGAR_ORDEN]. DIÓCESIS: [DIOCESIS_ORDEN].',
    vinculo_civil: 'REGISTRO CIVIL: NUIP/NIP [NUIP]. EXPEDIDO EN [OFICINA_REGISTRO] EL DÍA [FECHA_EXPEDICION_RC].',
    matrimonio_nulidad: 'ESTE MATRIMONIO FUE DECLARADO NULO MEDIANTE SENTENCIA DEL TRIBUNAL ECLESIÁSTICO. DECRETO NO. [NUMERO_DECRETO] DE FECHA [FECHA_DECRETO].',
    certificacion_estandar: 'LA INFORMACIÓN SUMINISTRADA ES FIEL A LA CONTENIDA EN EL LIBRO. SIN NOTAS MARGINALES ADICIONALES HASTA LA FECHA.'
});

const CODE_MAP = Object.freeze({
  CORRECTION_ORIGINAL: 'correccion_anulada',
  CORRECTION_REPLACEMENT: 'correccion_nueva',
  REPLACEMENT_NEW: 'reposicion_nueva',
  TRANSCRIPTION_ERROR: 'error_transcripcion',
  BAPTISM_CONFIRMATION: 'bautismo_confirmado',
  BAPTISM_MARRIAGE: 'bautismo_casado',
  BAPTISM_MARRIAGE_NULLITY: 'bautismo_nulidad_mat',
  HOLY_ORDERS: 'bautismo_orden',
  CIVIL_REGISTRY: 'vinculo_civil',
  MARRIAGE_NULLITY: 'matrimonio_nulidad',
  STANDARD_CERTIFICATION: 'certificacion_estandar',
});

const mergeTemplates = (value) => ({ ...DEFAULT_MARGINAL_NOTE_TEMPLATES, ...(value || {}) });

async function getLegacyFallback(parishId) {
  if (!parishId) return {};
  const { data, error } = await supabase
    .from('parish_parameters')
    .select('marginal_notes_templates,bautizos_params')
    .eq('parish_id', parishId)
    .maybeSingle();
  if (error) return {};
  const canonical = data?.marginal_notes_templates;
  const legacy = data?.bautizos_params?.plantillas_notas;
  return canonical && Object.keys(canonical).length ? canonical : (legacy || {});
}

/**
 * Adaptador de compatibilidad para módulos heredados.
 * La fuente oficial es marginal_note_templates V2; parish_parameters sólo se
 * consulta como fallback durante la migración.
 */
export const getMarginalNoteTemplates = async (parishId) => {
  let dioceseId = null;
  if (parishId) {
    const { data } = await supabase.from('parishes').select('diocese_id').eq('id', parishId).maybeSingle();
    dioceseId = data?.diocese_id || null;
  }

  try {
    const resolved = await getResolvedMarginalTemplates({ sacramentType: 'any', dioceseId, parishId });
    const adapted = {};
    resolved.forEach((template) => {
      const key = CODE_MAP[String(template.code || '').toUpperCase()];
      if (key && template.base_text) adapted[key] = template.base_text;
    });
    const fallback = await getLegacyFallback(parishId);
    return mergeTemplates({ ...fallback, ...adapted });
  } catch (error) {
    console.warn('Plantillas V2 no disponibles; se usa fallback temporal de Supabase.', error);
    return mergeTemplates(await getLegacyFallback(parishId));
  }
};

export const saveMarginalNoteTemplates = async () => {
  throw new Error('Las plantillas jurídicas ahora son versionadas y se administran desde Cancillería/Diócesis. La parroquia puede añadir notas opcionales o internas directamente a cada partida.');
};
