import { supabase } from '@/lib/supabaseClient';

// La calificación describe el doble contraste; NUNCA autentica una sentencia.
export const COURT_ASSESSMENTS = Object.freeze({
  awaiting_chancery_check: 'Pendiente de cotejo inicial de Cancillería',
  awaiting_diocesan_check: 'Pendiente de contraste independiente de Diócesis',
  invalid_independence: 'Identidades no independientes: detener el trámite',
  discrepancy_requires_resolution: 'DISCREPANCIA: se necesita aclaración y revisión jurídica',
  clarification_required: 'ACLARACIÓN DOCUMENTAL NECESARIA',
  reference_checks_concordant_not_certified: 'Referencias coincidentes; autenticidad NO certificada',
  manual_review_required: 'Revisión institucional adicional necesaria'
});

export async function getCourtReceiptInstitutionalState(receiptId) {
  if (!receiptId) throw new Error('Identificador de recepción inválido');
  const [assessment, clarifications] = await Promise.all([
    supabase.rpc('get_court_receipt_dual_control_summary_v111', { p_receipt_id: receiptId }),
    supabase.rpc('get_court_clarifications_v113', { p_receipt_id: receiptId })
  ]);
  if (assessment.error) throw assessment.error;
  if (clarifications.error) throw clarifications.error;
  if (assessment.data?.receipt_id !== receiptId || clarifications.data?.receipt_id !== receiptId) {
    throw new Error('El resultado no corresponde a la recepción consultada');
  }
  return {
    assessment: assessment.data,
    clarifications: Array.isArray(clarifications.data?.items) ? clarifications.data.items : []
  };
}

export async function recordCourtClarification({ receiptId, action, description, reference, clarificationId = null }) {
  if (!receiptId || !['request', 'respond'].includes(action)) throw new Error('Acción inválida');
  const text = description?.trim() || '';
  const doc = reference?.trim() || '';
  if (text.length < 40 || doc.length < 8) throw new Error('Se requieren explicación de 40 caracteres y referencia de 8.');
  if (action === 'respond' && !clarificationId) throw new Error('Identifique el requerimiento al que responde');
  const { data, error } = await supabase.rpc('record_court_clarification_v112', {
    p_receipt_id: receiptId,
    p_action: action,
    p_text: text,
    p_reference: doc,
    p_clarification_id: action === 'respond' ? clarificationId : null
  });
  if (error) throw error;
  return data;
}
