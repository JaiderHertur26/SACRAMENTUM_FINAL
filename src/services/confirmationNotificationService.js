import { supabase } from '@/lib/supabaseClient';

export async function loadConfirmationNotificationContext({ parishId, dioceseId }) {
  const [confirmationsResult,parishesResult] = await Promise.all([
    supabase.from('confirmations')
      .select('id,nombres,apellidos,celebration_date,book_number,folio,number,lugar_bautismo,fecha_bautismo,raw_data,status')
      .eq('parish_id',parishId)
      .order('celebration_date',{ascending:false})
      .limit(500),
    supabase.from('parishes')
      .select('id,name,city,diocese_id')
      .eq('diocese_id',dioceseId)
      .order('name')
  ]);
  if(confirmationsResult.error) throw confirmationsResult.error;
  if(parishesResult.error) throw parishesResult.error;
  return {
    confirmations:(confirmationsResult.data||[]).filter(r=>!['anulada','annulled','deleted','reverted','cancelled'].includes(String(r.status||'').toLowerCase())),
    parishes:parishesResult.data||[]
  };
}

export async function issueConfirmationNotification({
  confirmationId,
  receiverParishId,
  targetBaptismId = null,
  book = '',
  folio = '',
  number = '',
  note = '',
}) {
  const { data,error } = await supabase.rpc('issue_confirmation_notification_v43',{
    p_confirmation_id:confirmationId,
    p_receiver_parish_id:receiverParishId,
    p_target_baptism_id:targetBaptismId,
    p_manual_locator:{book,folio,number},
    p_note:note||null,
    p_payload:{source:'confirmation_notification_ui_v43'}
  });
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}
