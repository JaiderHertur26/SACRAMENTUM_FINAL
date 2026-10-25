import { supabase } from '@/lib/supabaseClient';
import { generateUUID } from '@/utils/supabaseHelpers';

// Keep the request ID for the lifetime of one form attempt. No automatic write retry.
export const createPendingRegistrationWithClient = (client, {
  kind, parishId, record, confirmationRecord = null, requestId
}) => {
  const payload = { ...(record || {}) };
  // These values are assigned by PostgreSQL and can change during preview refresh.
  for (const key of ['id', 'numero', 'numeroRegistro', 'numero_registro']) delete payload[key];
  return client.rpc('create_pending_registration_v207', {
  p_kind: kind,
  p_request_id: requestId || generateUUID(),
  p_parish_id: parishId,
  p_record: payload,
  p_confirmation_record: confirmationRecord
  });
};

export const createPendingRegistration = options =>
  createPendingRegistrationWithClient(supabase, options);
