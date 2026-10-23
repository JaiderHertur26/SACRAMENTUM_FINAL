import { supabase } from '@/lib/supabaseClient';

// V156: requests, authorization and execution ALWAYS go through institutional RPC.
// Do not update marginal_notes, decretos or reconciliation rows directly from UI.
const rpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
};

export const listLaterNoteReconciliations = (dioceseId) =>
  rpc('list_later_note_reconciliations_v157',{p_diocese_id:dioceseId});

export const requestLaterNoteReconciliation = ({decreeId,noteId,reason,sourceReference}) =>
  rpc('request_later_note_reconciliation_v156',{
    p_decree_id:decreeId,p_note_id:noteId,p_reason:reason,p_source_reference:sourceReference
  });

export const approveLaterNoteReconciliation = ({caseId,authorizationReference,approvalReason}) =>
  rpc('approve_later_note_reconciliation_v156',{
    p_case_id:caseId,p_authorization_reference:authorizationReference,p_approval_reason:approvalReason
  });

export const rejectLaterNoteReconciliation = ({caseId,rejectionReference,rejectionReason}) =>
  rpc('reject_later_note_reconciliation_v157',{
    p_case_id:caseId,p_rejection_reference:rejectionReference,p_rejection_reason:rejectionReason
  });

export const executeLaterNoteReconciliation = (caseId) =>
  rpc('execute_later_note_reconciliation_v156',{p_case_id:caseId});
