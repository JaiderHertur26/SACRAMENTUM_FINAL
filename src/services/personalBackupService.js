import { supabase } from '@/lib/supabaseClient';

async function backupRequest(action, args = {}, signal) {
  const request = supabase.rpc('personal_backup_v329', { p_action: action, ...args });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw new Error(error.message);
  return data;
}

export const loadPersonalBackup = (signal) => backupRequest('status', {}, signal);
export const exportPersonalBackup = (signal) => backupRequest('export', {}, signal);
export const importPersonalBackup = (file, signal) => backupRequest('import', { p_file: file }, signal);
export const readPersonalBackupSection = (copyId, section, offset, signal) =>
  backupRequest('section', { p_copy_id: copyId, p_section: section, p_offset: offset }, signal);
