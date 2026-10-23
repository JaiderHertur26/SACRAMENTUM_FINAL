-- SACRAMENTUM V161
-- Restore access to historical pending institutional cases previously hidden by
-- unconditional DESC LIMIT 300. Status filter + stable keyset pagination.
-- No sacramental data mutation, no direct table access grants.
CREATE OR REPLACE FUNCTION public.list_later_note_reconciliations_v161(
 p_diocese_id uuid,
 p_status text DEFAULT 'all',
 p_page_size integer DEFAULT 50,
 p_before_requested_at timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL
)
RETURNS TABLE(
 id uuid,decree_id uuid,note_id uuid,parish_id uuid,diocese_id uuid,
 status text,request_reason text,source_reference text,
 requested_by uuid,requested_at timestamptz,
 approved_by uuid,approval_reference text,approval_reason text,approved_at timestamptz,
 rejected_by uuid,rejection_reference text,rejection_reason text,rejected_at timestamptz,
 executed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $v161$
DECLARE v_status text:=lower(btrim(coalesce(p_status,'')));
BEGIN
 IF auth.uid() IS NULL
    OR public.current_app_role() NOT IN ('chancery','diocese')
    OR public.current_app_diocese_id() IS DISTINCT FROM p_diocese_id
 THEN
   RAISE EXCEPTION 'No autorizado a consultar expedientes de otra diócesis'
   USING errcode='42501';
 END IF;
 IF v_status NOT IN ('all','pending','authorized','executed','rejected')
    OR p_page_size NOT BETWEEN 1 AND 100
    OR (p_before_requested_at IS NULL) IS DISTINCT FROM (p_before_id IS NULL)
 THEN
   RAISE EXCEPTION 'Filtro, límite o cursor de conciliaciones inválido' USING errcode='22023';
 END IF;
 RETURN QUERY
 SELECT r.id,r.decree_id,r.note_id,r.parish_id,r.diocese_id,
 r.status,r.request_reason,r.source_reference,r.requested_by,r.requested_at,
 r.approved_by,r.approval_reference,r.approval_reason,r.approved_at,
 r.rejected_by,r.rejection_reference,r.rejection_reason,r.rejected_at,
 r.executed_at
 FROM public.later_note_reconciliations_v156 r
 WHERE r.diocese_id=p_diocese_id
   AND (v_status='all' OR r.status=v_status)
   AND (
     p_before_requested_at IS NULL
     OR (r.requested_at,r.id)<(p_before_requested_at,p_before_id)
   )
 ORDER BY r.requested_at DESC,r.id DESC
 LIMIT p_page_size;
END $v161$;

CREATE OR REPLACE FUNCTION public.count_later_note_reconciliations_v161(p_diocese_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $v161$
DECLARE v_counts jsonb;
BEGIN
 IF auth.uid() IS NULL
    OR public.current_app_role() NOT IN ('chancery','diocese')
    OR public.current_app_diocese_id() IS DISTINCT FROM p_diocese_id
 THEN
   RAISE EXCEPTION 'No autorizado a contar expedientes de otra diócesis'
   USING errcode='42501';
 END IF;
 SELECT jsonb_build_object(
   'all',count(*),
   'pending',count(*) FILTER (WHERE r.status='pending'),
   'authorized',count(*) FILTER (WHERE r.status='authorized'),
   'executed',count(*) FILTER (WHERE r.status='executed'),
   'rejected',count(*) FILTER (WHERE r.status='rejected')
 ) INTO v_counts
 FROM public.later_note_reconciliations_v156 r
 WHERE r.diocese_id=p_diocese_id;
 RETURN v_counts;
END $v161$;

CREATE INDEX IF NOT EXISTS idx_later_note_keyset_all_v161
 ON public.later_note_reconciliations_v156(diocese_id,requested_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_later_note_keyset_status_v161
 ON public.later_note_reconciliations_v156(diocese_id,status,requested_at DESC,id DESC);

REVOKE ALL ON FUNCTION public.list_later_note_reconciliations_v161(uuid,text,integer,timestamptz,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.count_later_note_reconciliations_v161(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_later_note_reconciliations_v161(uuid,text,integer,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_later_note_reconciliations_v161(uuid) TO authenticated;
