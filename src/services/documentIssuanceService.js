import { supabase } from '@/lib/supabaseClient';

export async function issueDocumentFromTemplate({
  templateId,
  variables = {},
  scopeId = null,
  linkedEntityType = null,
  linkedEntityId = null,
  metadata = {},
} = {}) {
  if (!templateId) throw new Error('Debe seleccionar una plantilla documental.');

  const { data, error } = await supabase.rpc('issue_document_from_template', {
    p_template_id: templateId,
    p_variables: variables,
    p_scope_id: scopeId || null,
    p_linked_entity_type: linkedEntityType || null,
    p_linked_entity_id: linkedEntityId || null,
    p_metadata: metadata || {},
  });

  if (error) throw error;
  return data || null;
}
export async function listDocumentIssuances({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('document_issuances')
    .select('id,document_number,template_id,template_code,template_version,legacy_code,title,category,scope_type,scope_id,diocese_id,parish_id,rendered_text,variables,linked_entity_type,linked_entity_id,status,issued_at,voided_at,void_reason,metadata')
    .order('issued_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function voidDocumentIssuance(issuanceId, reason) {
  if (!issuanceId) throw new Error('Documento no identificado.');
  if (!String(reason || '').trim()) throw new Error('Debe indicar el motivo de anulación.');

  const { error } = await supabase.rpc('void_document_issuance', {
    p_issuance_id: issuanceId,
    p_reason: String(reason).trim(),
  });
  if (error) throw error;
  return true;
}
export async function loadDocumentInstitutionalDefaults({ parishId = null, dioceseId = null } = {}) {
  const defaults = {};

  if (parishId) {
    const { data: parish, error: parishError } = await supabase
      .from('parishes')
      .select('id,name,city,address,phone,diocese_id,parroco')
      .eq('id', parishId)
      .maybeSingle();
    if (parishError) throw parishError;

    if (parish) {
      defaults.Miparroquia = parish.name || '';
      defaults.Miciudad = parish.city || '';
      defaults.MiDireccion = parish.address || '';
      defaults.Mitelefono = parish.phone || '';
      defaults.Parroco = parish.parroco || '';
      dioceseId = dioceseId || parish.diocese_id || null;
    }

    const { data: priests, error: priestError } = await supabase
      .from('parrocos')
      .select('nombre,apellido,estado,fecha_ingreso,created_at')
      .eq('parish_id', parishId)
      .order('fecha_ingreso', { ascending: false })
      .limit(20);
    if (!priestError && priests?.length) {
      const active = priests.find((p) => String(p.estado) === '1') || priests[0];
      const full = [active.nombre, active.apellido].filter(Boolean).join(' ');
      defaults.DaFe = full || defaults.Parroco || '';
      defaults.Parroco = full || defaults.Parroco || '';
    }
  }

  if (dioceseId) {
    const { data: diocese, error: dioceseError } = await supabase
      .from('dioceses')
      .select('id,name,city,bishop_name,bishop')
      .eq('id', dioceseId)
      .maybeSingle();
    if (dioceseError) throw dioceseError;

    if (diocese) {
      defaults.MiDiocesis = diocese.name || '';
      defaults.Diocesis = diocese.name || '';
      defaults.Obispo = diocese.bishop_name || diocese.bishop || '';
      if (!defaults.Miciudad) defaults.Miciudad = diocese.city || '';
    }
  }

  return defaults;
}


export async function searchDocumentContext(term, limit = 30) {
  const query = String(term || '').trim();
  if (query.length < 2) return [];

  const { data, error } = await supabase.rpc('search_document_context', {
    p_term: query,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}
