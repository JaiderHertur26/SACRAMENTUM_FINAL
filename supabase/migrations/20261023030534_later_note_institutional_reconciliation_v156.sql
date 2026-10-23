-- V156: institutional two-person authority for independent MANUAL note reconciliation.
-- Chancery proposes; Diocese approves; Chancery executes the approved
-- reconciliation AND decree reversal atomically. No independent note erasure.
CREATE TABLE IF NOT EXISTS public.later_note_reconciliations_v156 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 decree_id uuid NOT NULL REFERENCES public.decretos(id),
 note_id uuid NOT NULL REFERENCES public.marginal_notes(id),
 parish_id uuid NOT NULL REFERENCES public.parishes(id),
 diocese_id uuid NOT NULL REFERENCES public.dioceses(id),
 note_snapshot jsonb NOT NULL,
 request_reason text NOT NULL,
 source_reference text NOT NULL,
 requested_by uuid NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending'
   CHECK (status IN ('pending','authorized','executed','rejected')),
 approved_by uuid,
 approval_reference text,
 approval_reason text,
 approved_at timestamptz,
 executed_by uuid,
 executed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (approved_by IS NULL OR approved_by IS DISTINCT FROM requested_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_later_note_open_decree_v156
ON public.later_note_reconciliations_v156(decree_id,note_id)
WHERE status IN ('pending','authorized','executed');
CREATE INDEX IF NOT EXISTS idx_later_note_authority_v156
ON public.later_note_reconciliations_v156(diocese_id,status,requested_at DESC);
ALTER TABLE public.later_note_reconciliations_v156 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.later_note_reconciliations_v156 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_later_note_reconciliation_v156(
 p_decree_id uuid,p_note_id uuid,p_reason text,p_source_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $v156$
DECLARE
 v_d public.decretos%rowtype;
 v_n public.marginal_notes%rowtype;
 v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.current_app_role() IS DISTINCT FROM 'chancery' THEN
  RAISE EXCEPTION 'Sólo Cancillería puede solicitar conciliación' USING errcode='42501';
 END IF;
 IF length(btrim(coalesce(p_reason,'')))<25 OR length(btrim(coalesce(p_source_reference,'')))<8 THEN
  RAISE EXCEPTION 'Motivo documentado y referencia verificable obligatorios' USING errcode='23514';
 END IF;
 SELECT * INTO v_d FROM public.decretos WHERE id=p_decree_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decreto no encontrado';END IF;
 PERFORM public.sacramentum_assert_chancery_for_parish(v_d.parish_id);
 IF v_d.diocese_id IS DISTINCT FROM public.current_app_diocese_id()
    OR v_d.tipo NOT IN ('correccion','reposicion')
    OR v_d.sacrament_type NOT IN ('bautismo','confirmacion','matrimonio','exequias')
    OR v_d.status IS DISTINCT FROM 'active'
    OR v_d.replacement_record_id IS NULL
 THEN RAISE EXCEPTION 'Decreto no apto para conciliar notas posteriores' USING errcode='23514';END IF;
 SELECT * INTO v_n FROM public.marginal_notes WHERE id=p_note_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nota marginal no encontrada';END IF;
 IF v_n.parish_id IS DISTINCT FROM v_d.parish_id
   OR v_n.sacrament_id IS DISTINCT FROM v_d.replacement_record_id
   OR lower(v_n.sacrament_type) IS DISTINCT FROM lower(v_d.sacrament_type)
   OR v_n.status IS DISTINCT FROM 'active'
   OR lower(coalesce(v_n.note_type,''))<>'manual'
   OR lower(coalesce(v_n.source_type,'')) NOT IN ('','manual')
   OR v_n.decree_id IS NOT NULL
   OR v_n.is_locked IS DISTINCT FROM false
   OR v_n.print_policy IS DISTINCT FROM 'optional'
 THEN RAISE EXCEPTION 'Sólo notas manuales independientes, activas y no obligatorias pueden seguir este procedimiento' USING errcode='23514';END IF;
 INSERT INTO public.later_note_reconciliations_v156
 (decree_id,note_id,parish_id,diocese_id,note_snapshot,request_reason,source_reference,requested_by)
 VALUES(p_decree_id,p_note_id,v_d.parish_id,v_d.diocese_id,to_jsonb(v_n),btrim(p_reason),btrim(p_source_reference),auth.uid())
 RETURNING id INTO v_id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(auth.uid(),v_d.parish_id,v_d.diocese_id,'marginal_note_reconciliation',v_id,
 'reconciliation_requested',
 jsonb_build_object('decree_id',p_decree_id,'note_id',p_note_id,'status','pending'),
 jsonb_build_object('reason',btrim(p_reason),'source_reference',btrim(p_source_reference)));
 RETURN v_id;
END $v156$;

CREATE OR REPLACE FUNCTION public.approve_later_note_reconciliation_v156(
 p_case_id uuid,p_authorization_reference text,p_approval_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $v156$
DECLARE
 v_role text;
 v_dio uuid;
 v_case public.later_note_reconciliations_v156%rowtype;
 v_d public.decretos%rowtype;
 v_n public.marginal_notes%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode='42501';END IF;
 SELECT lower(u.role),u.diocese_id INTO v_role,v_dio
 FROM public.user_profiles u
 WHERE u.auth_user_id=auth.uid() AND coalesce(u.is_active,true)
   AND lower(coalesce(u.status,'active'))='active' LIMIT 1;
 IF v_role IS DISTINCT FROM 'diocese' OR v_dio IS NULL THEN
  RAISE EXCEPTION 'Sólo Diócesis puede autorizar, desde cuenta distinta de Cancillería' USING errcode='42501';END IF;
 IF length(btrim(coalesce(p_authorization_reference,'')))<8
    OR length(btrim(coalesce(p_approval_reason,'')))<15 THEN
  RAISE EXCEPTION 'Referencia de autorización y motivación episcopal obligatorias' USING errcode='23514';END IF;
 SELECT * INTO v_case FROM public.later_note_reconciliations_v156 WHERE id=p_case_id FOR UPDATE;
 IF NOT FOUND OR v_case.status IS DISTINCT FROM 'pending'
    OR v_case.diocese_id IS DISTINCT FROM v_dio
    OR v_case.requested_by=auth.uid() THEN
  RAISE EXCEPTION 'Expediente ajeno, no pendiente o sin separación de funciones' USING errcode='42501';END IF;
 SELECT * INTO v_d FROM public.decretos WHERE id=v_case.decree_id FOR UPDATE;
 SELECT * INTO v_n FROM public.marginal_notes WHERE id=v_case.note_id FOR UPDATE;
 IF v_d.status IS DISTINCT FROM 'active'
    OR v_d.parish_id IS DISTINCT FROM v_case.parish_id
    OR v_d.diocese_id IS DISTINCT FROM v_case.diocese_id
    OR to_jsonb(v_n) IS DISTINCT FROM v_case.note_snapshot THEN
  RAISE EXCEPTION 'La nota o el decreto cambiaron: requiere nueva solicitud' USING errcode='23514';END IF;
 UPDATE public.later_note_reconciliations_v156
 SET status='authorized', approved_by=auth.uid(),
 approval_reference=btrim(p_authorization_reference),approval_reason=btrim(p_approval_reason),
 approved_at=now(),updated_at=now() WHERE id=v_case.id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 VALUES(auth.uid(),v_case.parish_id,v_case.diocese_id,'marginal_note_reconciliation',
 v_case.id,'reconciliation_authorized',jsonb_build_object('status','authorized'),
 jsonb_build_object('authorization_reference',btrim(p_authorization_reference),'approval_reason',btrim(p_approval_reason)));
 RETURN jsonb_build_object('case_id',v_case.id,'status','authorized');
END $v156$;

CREATE OR REPLACE FUNCTION public.execute_later_note_reconciliation_v156(p_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $v156$
DECLARE
 v_case public.later_note_reconciliations_v156%rowtype;
 v_d public.decretos%rowtype;
 v_n public.marginal_notes%rowtype;
 v_reason text;
 v_out jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.current_app_role() IS DISTINCT FROM 'chancery' THEN
  RAISE EXCEPTION 'Sólo Cancillería puede ejecutar una conciliación autorizada' USING errcode='42501';END IF;
 SELECT * INTO v_case FROM public.later_note_reconciliations_v156 WHERE id=p_case_id FOR UPDATE;
 IF NOT FOUND OR v_case.status IS DISTINCT FROM 'authorized'
    OR v_case.approved_by IS NULL OR v_case.approved_by=v_case.requested_by THEN
  RAISE EXCEPTION 'Conciliación sin autorización institucional independiente' USING errcode='42501';END IF;
 PERFORM public.sacramentum_assert_chancery_for_parish(v_case.parish_id);
 IF v_case.diocese_id IS DISTINCT FROM public.current_app_diocese_id()
 THEN RAISE EXCEPTION 'Conciliación fuera de jurisdicción' USING errcode='42501';END IF;
 SELECT * INTO v_d FROM public.decretos WHERE id=v_case.decree_id FOR UPDATE;
 SELECT * INTO v_n FROM public.marginal_notes WHERE id=v_case.note_id FOR UPDATE;
 IF v_d.status IS DISTINCT FROM 'active'
    OR v_d.parish_id IS DISTINCT FROM v_case.parish_id
    OR v_d.diocese_id IS DISTINCT FROM v_case.diocese_id
    OR v_d.replacement_record_id IS DISTINCT FROM v_n.sacrament_id
    OR lower(v_d.sacrament_type) IS DISTINCT FROM lower(v_n.sacrament_type)
    OR to_jsonb(v_n) IS DISTINCT FROM v_case.note_snapshot THEN
  RAISE EXCEPTION 'La nota o el decreto cambiaron: no se puede ejecutar' USING errcode='23514';END IF;
 -- Only the independently authorized note is changed; any OTHER later note
 -- still blocks the existing reversal and therefore rolls back the entire RPC.
 UPDATE public.marginal_notes SET status='reversed',updated_at=now()
 WHERE id=v_n.id AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'Nota ya conciliada por otro procedimiento' USING errcode='23514';END IF;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
 VALUES(auth.uid(),v_case.parish_id,v_case.diocese_id,'marginal_note',v_n.id,
 'manual_note_reconciled_before_decree_reversal',to_jsonb(v_n),
 jsonb_build_object('status','reversed','content',v_n.content,'decree_id',v_d.id),
 jsonb_build_object('case_id',v_case.id,'authorization_reference',v_case.approval_reference,'source_reference',v_case.source_reference));
 v_reason:='CONCILIACIÓN AUTORIZADA '||v_case.approval_reference||'. '||v_case.request_reason;
 IF v_d.sacrament_type='bautismo' THEN
  IF v_d.tipo='correccion' THEN
   PERFORM public.reverse_correction_decree_with_reason(v_d.id,v_reason);
  ELSE
   PERFORM public.reverse_replacement_decree_with_reason(v_d.id,v_reason);
  END IF;
 ELSIF v_d.sacrament_type='confirmacion' THEN
  IF v_d.tipo='correccion' THEN
   PERFORM public.reverse_correction_decree_with_reason(v_d.id,v_reason);
  ELSE
   PERFORM public.reverse_replacement_decree_with_reason(v_d.id,v_reason);
  END IF;
 ELSIF v_d.sacrament_type='matrimonio' THEN
  PERFORM 1 FROM public.reverse_marriage_decree(v_d.id,v_reason);
 ELSIF v_d.sacrament_type='exequias' THEN
  PERFORM 1 FROM public.reverse_funeral_decree(v_d.id,v_reason);
 ELSE
  RAISE EXCEPTION 'Sacramento no autorizado para conciliación' USING errcode='23514';
 END IF;
 IF (SELECT status FROM public.decretos WHERE id=v_d.id) IS DISTINCT FROM 'reversed'
 THEN RAISE EXCEPTION 'No se confirmó reversión íntegra del decreto' USING errcode='23514'; END IF;
 UPDATE public.later_note_reconciliations_v156 SET status='executed',
 executed_by=auth.uid(),executed_at=now(),updated_at=now()
 WHERE id=v_case.id;
 INSERT INTO public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
 VALUES(auth.uid(),v_case.parish_id,v_case.diocese_id,'marginal_note_reconciliation',v_case.id,
 'reconciliation_executed',jsonb_build_object('status','authorized','note_id',v_case.note_id,'decree_id',v_case.decree_id),
 jsonb_build_object('status','executed','note_status','reversed','decree_status','reversed'),
 jsonb_build_object('authorization_reference',v_case.approval_reference,'source_reference',v_case.source_reference));
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,decree_id,category,subject,message,status,payload,created_by)
 VALUES(v_case.diocese_id,v_case.parish_id,v_d.id,'decree_reconciliation',
 'Conciliación de nota marginal y reversión de decreto',
 'Se ejecutó una conciliación autorizada y la reversión del decreto '||coalesce(v_d.decree_number,'SIN NÚMERO')||'. Consulte el expediente de auditoría.',
 'pending',
 jsonb_build_object('reconciliation_case_id',v_case.id,'note_id',v_case.note_id,'authorization_reference',v_case.approval_reference,'source_reference',v_case.source_reference),
 auth.uid());
 RETURN jsonb_build_object('case_id',v_case.id,'decree_id',v_d.id,'note_id',v_n.id,'status','executed');
END $v156$;

CREATE OR REPLACE FUNCTION public.list_later_note_reconciliations_v156(p_diocese_id uuid)
RETURNS TABLE(id uuid,decree_id uuid,note_id uuid,parish_id uuid,diocese_id uuid,
 status text,request_reason text,source_reference text,requested_by uuid,requested_at timestamptz,
 approved_by uuid,approval_reference text,approval_reason text,approved_at timestamptz,executed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $v156$
BEGIN
 IF auth.uid() IS NULL OR public.current_app_role() NOT IN ('chancery','diocese')
    OR public.current_app_diocese_id() IS DISTINCT FROM p_diocese_id
 THEN RAISE EXCEPTION 'No autorizado a consultar conciliaciones de otra diócesis' USING errcode='42501';END IF;
 RETURN QUERY SELECT r.id,r.decree_id,r.note_id,r.parish_id,r.diocese_id,
 r.status,r.request_reason,r.source_reference,r.requested_by,r.requested_at,
 r.approved_by,r.approval_reference,r.approval_reason,r.approved_at,r.executed_at
 FROM public.later_note_reconciliations_v156 r
 WHERE r.diocese_id=p_diocese_id ORDER BY r.requested_at DESC LIMIT 300;
END $v156$;

REVOKE ALL ON FUNCTION public.request_later_note_reconciliation_v156(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.approve_later_note_reconciliation_v156(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.execute_later_note_reconciliation_v156(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_later_note_reconciliations_v156(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_later_note_reconciliation_v156(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_later_note_reconciliation_v156(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_later_note_reconciliation_v156(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_later_note_reconciliations_v156(uuid) TO authenticated;
