-- V218. Review-only canonical queue for historical links with missing physical destinations.
-- Never repair, delete, or move a sacramental entry automatically.
CREATE TABLE IF NOT EXISTS public.legacy_link_review_events_v218 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.legacy_record_links(id) ON DELETE RESTRICT,
  parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE RESTRICT,
  diocese_id uuid NOT NULL REFERENCES public.dioceses(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('investigate','source_verified','not_found','escalated')),
  evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 8 AND 180),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_legacy_link_review_events_v218_link_created
 ON public.legacy_link_review_events_v218(link_id, created_at DESC, id DESC);
ALTER TABLE public.legacy_link_review_events_v218 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_link_review_events_v218 FROM PUBLIC, anon, authenticated;

-- Show only orphaned baptism/confirmation links belonging to the signed-in
-- chancery's own diocese. Do not return personal names or original JSON.
CREATE OR REPLACE FUNCTION public.list_unresolved_legacy_links_v218(
 p_parish_id uuid DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS TABLE(
 link_id uuid, parish_id uuid, profile_key text, source_key text,
 book_number text, folio text, entry_number text, target_id uuid,
 latest_decision text, evidence_reference text, reviewed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_diocese uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode='42501';END IF;
  SELECT up.diocese_id INTO v_diocese
  FROM public.user_profiles up
  JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id
  WHERE up.auth_user_id=auth.uid() AND lower(up.role)='chancery'
    AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
  LIMIT 1;
  IF v_diocese IS NULL THEN RAISE EXCEPTION 'Acceso exclusivo de Cancillería activa' USING errcode='42501';END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 5000 THEN
    RAISE EXCEPTION 'Paginación fuera de límites' USING errcode='22023';
  END IF;
  IF p_parish_id IS NOT NULL AND NOT EXISTS(
     SELECT 1 FROM public.parishes p WHERE p.id=p_parish_id AND p.diocese_id=v_diocese
  ) THEN RAISE EXCEPTION 'Parroquia fuera de jurisdicción' USING errcode='42501';END IF;
  RETURN QUERY
  SELECT l.id,p.id,l.profile_key::text,l.source_key::text,
    coalesce(nullif(r.normalized_data->>'book_number',''),nullif(r.normalized_data->>'book',''))::text,
    nullif(r.normalized_data->>'folio','')::text,
    coalesce(nullif(r.normalized_data->>'number',''),nullif(r.normalized_data->>'numero',''))::text,
    l.target_id,ev.decision::text,ev.evidence_reference::text,ev.created_at
  FROM public.legacy_record_links l
  JOIN public.legacy_import_batches b ON b.id=l.batch_id
  JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=v_diocese
  JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id
  LEFT JOIN LATERAL (
     SELECT e.decision,e.evidence_reference,e.created_at FROM public.legacy_link_review_events_v218 e
     WHERE e.link_id=l.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1
  ) ev ON TRUE
  LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
  LEFT JOIN public.confirmations co ON l.target_table='confirmation' AND co.id=l.target_id
  WHERE (p_parish_id IS NULL OR p.id=p_parish_id)
    AND ((l.target_table='baptism' AND ba.id IS NULL)
      OR (l.target_table='confirmation' AND co.id IS NULL))
  ORDER BY l.profile_key,l.id LIMIT p_limit OFFSET p_offset;
END $$;

-- An audit-only review event. Does NOT mark the link as reconciled or modify its target.
CREATE OR REPLACE FUNCTION public.record_unresolved_legacy_link_review_v218(
 p_link_id uuid,p_decision text,p_evidence_reference text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_diocese uuid;v_parish uuid;v_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode='42501';END IF;
 SELECT up.diocese_id INTO v_diocese
 FROM public.user_profiles up
 JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND lower(up.role)='chancery'
   AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
 LIMIT 1;
 IF v_diocese IS NULL THEN RAISE EXCEPTION 'Acceso exclusivo de Cancillería activa' USING errcode='42501';END IF;
 IF p_link_id IS NULL OR p_decision NOT IN ('investigate','source_verified','not_found','escalated')
    OR p_decision IS NULL OR p_evidence_reference IS NULL
    OR length(btrim(p_evidence_reference)) NOT BETWEEN 8 AND 180 THEN
   RAISE EXCEPTION 'Tipo de revisión o referencia inválida' USING errcode='22023';
 END IF;
 SELECT p.id INTO v_parish
 FROM public.legacy_record_links l
 JOIN public.legacy_import_batches b ON b.id=l.batch_id
 JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=v_diocese
 JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id
 LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
 LEFT JOIN public.confirmations co ON l.target_table='confirmation' AND co.id=l.target_id
 WHERE l.id=p_link_id
  AND ((l.target_table='baptism' AND ba.id IS NULL)
    OR (l.target_table='confirmation' AND co.id IS NULL));
 IF v_parish IS NULL THEN
    RAISE EXCEPTION 'Caso inexistente, ya localizado o ajeno a su diócesis' USING errcode='42501';
 END IF;
 INSERT INTO public.legacy_link_review_events_v218
   (link_id,parish_id,diocese_id,actor_user_id,decision,evidence_reference)
 VALUES (p_link_id,v_parish,v_diocese,auth.uid(),p_decision,btrim(p_evidence_reference))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
-- Jurisdiction-scoped counts for the dashboard: no personally identifying data.
CREATE OR REPLACE FUNCTION public.summarize_unresolved_legacy_links_v218()
RETURNS TABLE(profile_key text, unresolved bigint, affected_parishes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_diocese uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode='42501';END IF;
 SELECT up.diocese_id INTO v_diocese FROM public.user_profiles up
 JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND lower(up.role)='chancery'
   AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
 LIMIT 1;
 IF v_diocese IS NULL THEN RAISE EXCEPTION 'Acceso exclusivo de Cancillería activa' USING errcode='42501'; END IF;
 RETURN QUERY
 SELECT l.profile_key::text, count(*)::bigint, count(DISTINCT p.id)::bigint
 FROM public.legacy_record_links l
 JOIN public.legacy_import_batches b ON b.id=l.batch_id
 JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=v_diocese
 JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id
 LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
 LEFT JOIN public.confirmations co ON l.target_table='confirmation' AND co.id=l.target_id
 WHERE (l.target_table='baptism' AND ba.id IS NULL) OR (l.target_table='confirmation' AND co.id IS NULL)
 GROUP BY l.profile_key ORDER BY l.profile_key;
END $$;
REVOKE ALL ON FUNCTION public.summarize_unresolved_legacy_links_v218() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.summarize_unresolved_legacy_links_v218() TO authenticated;

REVOKE ALL ON FUNCTION public.list_unresolved_legacy_links_v218(uuid,integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_unresolved_legacy_link_review_v218(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_unresolved_legacy_links_v218(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_unresolved_legacy_link_review_v218(uuid,text,text) TO authenticated;
