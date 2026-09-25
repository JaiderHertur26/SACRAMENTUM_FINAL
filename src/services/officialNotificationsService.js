import { supabase } from '@/lib/supabaseClient';
import { TABLE_NAMES, NOTIFICATION_STATUS } from '@/config/supabaseConfig';

const normalizeDecreeType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('repos')) return 'reposicion';
  if (v.includes('anul') || v.includes('nul')) return 'anulacion';
  return 'correccion';
};

const normalize = (row) => ({
  ...row,
  createdAt: row.created_at,
  decree_id: row.decree_id,
  decree_type: normalizeDecreeType(row.payload?.decreeType || row.payload?.tipo || 'correccion'),
  sacramentType: String(row.payload?.sacramentType || row.payload?.sacramento || 'bautismo').toLowerCase()
});

export async function listOfficialNotifications(parishId) {
  if (!parishId) return [];
  const { data, error } = await supabase
    .from(TABLE_NAMES.OFFICIAL_NOTIFICATIONS)
    .select('*')
    .eq('receiver_parish_id', parishId)
    .not('status', 'in', '(cancelled,archived)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

export async function countUnreadOfficialNotifications(parishId) {
  if (!parishId) return 0;
  const { count, error } = await supabase
    .from(TABLE_NAMES.OFFICIAL_NOTIFICATIONS)
    .select('id', { count: 'exact', head: true })
    .eq('receiver_parish_id', parishId)
    .in('status', [NOTIFICATION_STATUS.PENDING, 'unread']);
  if (error) return 0;
  return count || 0;
}

export async function markOfficialNotificationRead(id) {
  const { error } = await supabase.rpc('mark_official_notification_read', { p_notification_id: id });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('mark_official_notification_read') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración de seguridad de notificaciones oficiales en Supabase.');
    }
    throw error;
  }
}

export async function archiveOfficialNotification(id) {
  const { error } = await supabase.rpc('archive_official_notification', { p_notification_id: id });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('archive_official_notification') || message.includes('Could not find the function')) {
      throw new Error('Falta aplicar la migración de seguridad de notificaciones oficiales en Supabase.');
    }
    throw error;
  }
}
