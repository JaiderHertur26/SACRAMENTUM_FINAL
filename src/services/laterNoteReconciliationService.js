import { supabase } from '@/lib/supabaseClient';

// V156: requests, authorization and execution ALWAYS go through institutional RPC.
// Do not update marginal_notes, decretos or reconciliation rows directly from UI.
const rpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
};

// V161: fetch current scope in bounded, deterministic keyset pages.
export const listLaterNoteReconciliations = (dioceseId, {status='all',limit=50,cursor=null}={}) =>
  rpc('list_later_note_reconciliations_v161',{
    p_diocese_id:dioceseId,p_status:status,p_page_size:limit,
    p_before_requested_at:cursor?.requested_at || null,
    p_before_id:cursor?.id || null
  });

export const countLaterNoteReconciliations = (dioceseId) =>
  rpc('count_later_note_reconciliations_v161',{p_diocese_id:dioceseId});

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


// V168: a decree with multiple independently approved later notes requires ONE
// atomic reversal, not repeated single-note executions.
export const executeLaterNoteReconciliationBatch = (caseIds) =>
  rpc('execute_later_note_reconciliation_batch_v168',{p_case_ids:caseIds});
