import { supabase } from '@/lib/supabaseClient';
import { listPendingMarriagesCloud } from '@/services/marriagesCloudService';

export async function listMarriageDossiers(parishId) {
  if (!parishId) return [];
  const { data, error } = await supabase
    .from('marriage_dossiers')
    .select('*')
    .eq('parish_id', parishId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadMarriageDossierSources(parishId) {
  const [dossiers,pending] = await Promise.all([
    listMarriageDossiers(parishId),
    listPendingMarriagesCloud(parishId),
  ]);
  return { dossiers, pending };
}

export async function saveMarriageDossier({
  id = null,
  parishId,
  pendingMarriageId = null,
  marriageId = null,
  dossierNumber = '',
  dossierDate = null,
  plannedMarriageDate = null,
  ceremonyPlace = '',
  status = 'draft',
  dossierData = {},
}) {
  const { data, error } = await supabase.rpc('upsert_marriage_dossier_v43', {
    p_dossier_id: id,
    p_parish_id: parishId,
    p_pending_marriage_id: pendingMarriageId,
    p_marriage_id: marriageId,
    p_dossier_number: dossierNumber || null,
    p_dossier_date: dossierDate || null,
    p_planned_marriage_date: plannedMarriageDate || null,
    p_ceremony_place: ceremonyPlace || null,
    p_status: status,
    p_dossier_data: dossierData || {},
  });
  if (error) throw error;
  return data;
}
