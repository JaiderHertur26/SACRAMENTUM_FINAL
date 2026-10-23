-- V157 · Institutional negative decision and durable reopening path.
-- Diócesis may reject or revoke an unexecuted authorization with documented
-- reason. Neither decree nor marginal note can be mutated by this RPC.
ALTER TABLE public.later_note_reconciliations_v156
 ADD COLUMN IF NOT EXISTS rejected_by uuid,
 ADD COLUMN IF NOT EXISTS rejection_reference text,
 ADD COLUMN IF NOT EXISTS rejection_reason text,
 ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

CREATE OR REPLACE FUNCTION public.reject_later_note_reconciliation_v157(
 p_case_id uuid,
 p_rejection_reference text,
 p_rejection_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $v157$
DECLARE
 v_role text;
 v_diocese uuid;
 v_case public.later_note_reconciliations_v156%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Sesión autenticada requerida' USING errcode='42501';
 END IF;
 SELECT lower(u.role), u.diocese_id INTO v_role,v_diocese
 FROM public.user_profiles u WHERE u.auth_user_id=auth.uid()
 AND coalesce(u.is_active,true)
 AND lower(coalesce(u.status,'active'))='active'
 LIMIT 1;
 IF v_role IS DISTINCT FROM 'diocese' OR v_diocese IS NULL THEN
   RAISE EXCEPTION 'Sólo Diócesis puede rechazar o revocar una conciliación' USING errcode='42501';
 END IF;
 IF length(btrim(coalesce(p_rejection_reference,'')))<8
   OR length(btrim(coalesce(p_rejection_reason,'')))<20 THEN
   RAISE EXCEPTION 'Referencia y motivación documentadas obligatorias para rechazar' USING errcode='23514';
 END IF;
 SELECT * INTO v_case FROM public.later_note_reconciliations_v156
 WHERE id=p_case_id FOR UPDATE;
 IF NOT FOUND OR v_case.diocese_id IS DISTINCT FROM v_diocese
   OR v_case.status NOT IN ('pending','authorized')
   OR v_case.requested_by=auth.uid() THEN
   RAISE EXCEPTION 'Expediente ajeno, ejecutado o sin separación de funciones'
     USING errcode='42501';
 END IF;
 UPDATE public.later_note_reconciliations_v156
 SET status='rejected',rejected_by=auth.uid(),
 rejection_reference=btrim(p_rejection_reference),
 rejection_reason=btrim(p_rejection_reason),
 rejected_at=now(),updated_at=now()
 WHERE id=v_case.id;
 INSERT INTO public.registry_audit_log(
 actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,before_data,after_data,metadata
 ) VALUES(
 auth.uid(),v_case.parish_id,v_case.diocese_id,
 'marginal_note_reconciliation',v_case.id,
 CASE WHEN v_case.status='authorized' THEN 'reconciliation_authorization_revoked'
 ELSE 'reconciliation_rejected' END,
 jsonb_build_object('status',v_case.status,'decree_id',v_case.decree_id,
 'note_id',v_case.note_id,'approved_by',v_case.approved_by),
 jsonb_build_object('status','rejected','rejected_by',auth.uid()),
 jsonb_build_object('rejection_reference',btrim(p_rejection_reference),
 'rejection_reason',btrim(p_rejection_reason))
 );
 RETURN jsonb_build_object('case_id',v_case.id,'status','rejected',
 'previous_status',v_case.status);
END $v157$;

CREATE OR REPLACE FUNCTION public.list_later_note_reconciliations_v157(p_diocese_id uuid)
RETURNS TABLE(
 id uuid,decree_id uuid,note_id uuid,parish_id uuid,diocese_id uuid,
 status text,request_reason text,source_reference text,
 requested_by uuid,requested_at timestamptz,
 approved_by uuid,approval_reference text,approval_reason text,approved_at timestamptz,
 rejected_by uuid,rejection_reference text,rejection_reason text,rejected_at timestamptz,
 executed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $v157$
BEGIN
 IF auth.uid() IS NULL
   OR public.current_app_role() NOT IN ('chancery','diocese')
   OR public.current_app_diocese_id() IS DISTINCT FROM p_diocese_id
 THEN
   RAISE EXCEPTION 'No autorizado a consultar conciliaciones de otra diócesis' USING errcode='42501';
 END IF;
 RETURN QUERY
 SELECT r.id,r.decree_id,r.note_id,r.parish_id,r.diocese_id,
 r.status,r.request_reason,r.source_reference,r.requested_by,r.requested_at,
 r.approved_by,r.approval_reference,r.approval_reason,r.approved_at,
 r.rejected_by,r.rejection_reference,r.rejection_reason,r.rejected_at,
 r.executed_at
 FROM public.later_note_reconciliations_v156 r
 WHERE r.diocese_id=p_diocese_id
 ORDER BY r.requested_at DESC LIMIT 300;
END $v157$;

REVOKE ALL ON FUNCTION public.reject_later_note_reconciliation_v157(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_later_note_reconciliations_v157(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reject_later_note_reconciliation_v157(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_later_note_reconciliations_v157(uuid) TO authenticated;
