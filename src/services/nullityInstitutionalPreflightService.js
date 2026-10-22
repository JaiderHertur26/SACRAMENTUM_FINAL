import { supabase } from '@/lib/supabaseClient';

export async function listNullityPreflightCases(status = null) {
  const { data, error } = await supabase.rpc('list_marriage_nullity_execution_v130', { p_status: status });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('La consulta institucional no devolvió un expediente válido');
  return data;
}

export async function requestNullityPreflight({
  marriageId, decreeNumber, decreeDate, issuer, documentReference,
  documentDate, documentSha256, justification
}) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(marriageId?.trim() || '')) {
    throw new Error('Identifique una partida matrimonial por su UUID válido');
  }
  if (!/^[0-9a-f]{64}$/i.test(documentSha256 || '')) {
    throw new Error('Seleccione el archivo judicial para calcular su huella SHA-256');
  }
  if ((justification || '').trim().length < 40) {
    throw new Error('Documente los antecedentes en al menos 40 caracteres');
  }
  const { data, error } = await supabase.rpc('request_marriage_nullity_execution_v128', {
    p_marriage_id: marriageId.trim(),
    p_decree_number: decreeNumber.trim(),
    p_decree_date: decreeDate,
    p_court_issuer: issuer.trim(),
    p_court_document_reference: documentReference.trim(),
    p_court_document_date: documentDate,
    p_court_document_sha256: documentSha256.toLowerCase(),
    p_request_justification: justification.trim()
  });
  if (error) throw error;
  if (!data) throw new Error('No se obtuvo el identificador de la solicitud');
  return data;
}

export async function reviewNullityPreflight({authorizationId, decision, note, externalReference}) {
  if (!['authorize','reject'].includes(decision)) throw new Error('Decisión no admitida');
  const { data, error } = await supabase.rpc('review_marriage_nullity_execution_v128', {
    p_authorization_id: authorizationId, p_decision: decision,
    p_review_note: note.trim(), p_external_reference: externalReference.trim()
  });
  if (error) throw error;
  if (!['authorized','rejected'].includes(data?.status)) throw new Error('La revisión no quedó registrada');
  return data;
}

export async function executeAuthorizedNullity({row, baptismIds=[], reason}) {
  if (row.status !== 'authorized') throw new Error('Diócesis aún no ha autorizado la operación registral');
  if (baptismIds.length > 2 || new Set(baptismIds).size !== baptismIds.length)
    throw new Error('Seleccione como máximo dos partidas bautismales distintas');
  const { data, error } = await supabase.rpc('apply_marriage_nullity', {
    p_marriage_id: row.marriage_id, p_decree_number: row.decree_number,
    p_decree_date: row.decree_date, p_reason: reason,
    p_decree_payload: { preExecutionAuthorizationId: row.id },
    p_baptism_ids: baptismIds.length ? baptismIds : null
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1 || !data[0]?.decree_id) {
    throw new Error('La ejecución no devolvió exactamente un decreto');
  }
  return data[0];
}
