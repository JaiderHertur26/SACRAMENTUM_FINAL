import { supabase } from '@/lib/supabaseClient';

export async function nextDocumentNumber({ scopeId, documentType, prefix }) {
  if (!scopeId) throw new Error('No se pudo determinar el ámbito de numeración.');
  const { data, error } = await supabase.rpc('next_document_sequence', {
    p_scope_id: scopeId,
    p_document_type: documentType,
    p_prefix: prefix || null
  });
  if (error) throw error;
  if (!Array.isArray(data) || !data[0]?.document_number) throw new Error('Supabase no devolvió un consecutivo documental válido.');
  return data[0].document_number;
}
