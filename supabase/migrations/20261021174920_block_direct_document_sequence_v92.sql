-- V92 / security: prevent callers from consuming official document numbers
-- without issuing an audited document.
--
-- Reproduced before this migration:
-- authenticated parish user could call next_document_sequence with their
-- DIOCESAN scope and an arbitrary document type, obtaining QA-000001.
-- The proof was performed inside BEGIN ... ROLLBACK; no permanent sequence
-- was consumed. The application no longer calls this RPC directly.
--
-- Three legitimate callers remain:
-- public.issue_document_from_template
-- public.generate_diocesan_sacramental_report
-- public.issue_confirmation_notification_v43
-- All three are SECURITY DEFINER, owned by postgres, and retain permission
-- to call next_document_sequence internally while their own role/scope checks
-- and audit logic run.
REVOKE EXECUTE ON FUNCTION public.next_document_sequence(uuid,text,text)
  FROM PUBLIC, anon, authenticated;

-- Preserve the existing owner and service-role privileges.
COMMENT ON FUNCTION public.next_document_sequence(uuid,text,text)
  IS 'Privileged internal document allocator. Do not expose directly to authenticated or anon: use audited, authority-scoped issue_document_from_template and related institutional RPCs.';
