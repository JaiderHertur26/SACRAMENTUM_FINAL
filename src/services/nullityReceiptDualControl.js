import { supabase } from '@/lib/supabaseClient';
import { institutionalPrompt, institutionalConfirm } from '@/lib/institutionalDialog';

// A recorded assessment is evidence of an internal review, NEVER a judicial
// signature verification, an approval of the decree or a registral action.
const FINDINGS = Object.freeze({
  '1': 'reference_matches',
  '2': 'requires_clarification',
  '3': 'discrepancy_detected'
});
const CHANNELS = Object.freeze({
  '1': 'official_office_contact',
  '2': 'official_email',
  '3': 'official_letter'
});

export const submitCourtReceiptCheck = async ({ receiptId, stage, notify }) => {
  if (!receiptId || !['chancery_reference_check','diocesan_independent_check'].includes(stage))
    return false;
  const second = stage === 'diocesan_independent_check';
  const findingRaw = await institutionalPrompt({
    title: second ? 'Contraste independiente de Diócesis' : 'Cotejo documental de Cancillería',
    message: 'Calificación de la evidencia: 1 = referencia concordante; 2 = requiere aclaración; 3 = discrepancia. Esto NO certifica autenticidad judicial.',
    placeholder: '1, 2 o 3', required: true, minLength: 1, confirmText: 'Continuar'
  });
  if (findingRaw === null) return false;
  const finding = FINDINGS[findingRaw.trim()];
  if (!finding) {
    notify?.({ title: 'Hallazgo inválido', description: 'Seleccione 1, 2 o 3.', variant: 'destructive' });
    return false;
  }
  const channelRaw = await institutionalPrompt({
    title: 'Canal institucional de cotejo',
    message: '1 = contacto con oficina oficial; 2 = correo institucional; 3 = comunicación escrita oficial. Registre solo un canal realmente utilizado.',
    placeholder: '1, 2 o 3', required: true, minLength: 1, confirmText: 'Continuar'
  });
  if (channelRaw === null) return false;
  const channel = CHANNELS[channelRaw.trim()];
  if (!channel) {
    notify?.({ title: 'Canal inválido', description: 'Seleccione 1, 2 o 3.', variant: 'destructive' });
    return false;
  }
  const reference = await institutionalPrompt({
    title: 'Evidencia del contacto oficial',
    message: 'Escriba radicado, identificador del correo o constancia que permita cotejar esta consulta. Mínimo 12 caracteres.',
    placeholder: 'Referencia del contraste efectuado',
    required: true, minLength: 12, confirmText: 'Continuar'
  });
  if (reference === null) return false;
  const dateRaw = await institutionalPrompt({
    title: 'Fecha real del cotejo',
    message: 'Escriba la fecha AAAA-MM-DD, sin utilizar fechas futuras.',
    placeholder: 'AAAA-MM-DD', required: true, minLength: 10, confirmText: 'Continuar'
  });
  if (dateRaw === null) return false;
  const iso = dateRaw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso))
     || new Date(iso).toISOString().slice(0,10) !== iso) {
    notify?.({ title: 'Fecha inválida', description: 'Introduzca una fecha real AAAA-MM-DD.', variant: 'destructive' });
    return false;
  }
  const notes = await institutionalPrompt({
    title: 'Informe de cotejo documental',
    message: 'Explique el método, el dato contrastado y lo que sigue pendiente. Mínimo 40 caracteres.',
    placeholder: 'Detalle sustentado del cotejo',
    required: true, minLength: 40, confirmText: 'Continuar'
  });
  if (notes === null) return false;
  const approved = await institutionalConfirm({
    title: second ? 'Guardar contraste independiente' : 'Guardar cotejo de Cancillería',
    message: 'Se registrará un testimonio de cotejo, atribuible al usuario actual. No certifica autenticidad judicial, no ejecuta la decisión y no altera partidas ni notas.',
    confirmText: 'Guardar constancia', tone: 'warning'
  });
  if (!approved) return false;
  try {
    const { error } = await supabase.rpc('record_court_receipt_independent_check_v110',{
      p_receipt_id: receiptId,
      p_finding: finding,
      p_verification_channel: channel,
      p_external_contact_reference: reference.trim(),
      p_checked_on: iso,
      p_assessment_notes: notes.trim()
    });
    if (error) throw error;
    notify?.({ title: 'Cotejo registrado', description: 'Conservado sin verificar judicialmente ni modificar partidas.' });
    return true;
  } catch (error) {
    notify?.({ title: 'No se pudo registrar el cotejo', description: error.message, variant: 'destructive' });
    return false;
  }
};
