-- V219: historical-link diagnostic, non-mutating and available only to active Chancery.
-- Current database content is explicitly TEST-ONLY; no source UUID is repaired here.
CREATE OR REPLACE FUNCTION public.sacramentum_missing_link_assessment_v219(p_link_id uuid)
RETURNS TABLE(assessment text,candidate_id uuid)
LANGUAGE sql STABLE SET search_path TO '' AS $body$
 WITH original AS (
  SELECT l.id,l.target_table,b.parish_id,r.normalized_data
  FROM public.legacy_record_links l
  JOIN public.legacy_import_batches b ON b.id=l.batch_id
  JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id
  WHERE l.id=p_link_id
 ), candidate AS (
  SELECT o.id,o.target_table,
    (CASE WHEN o.target_table='baptism' THEN ba.match_count ELSE cf.match_count END) match_count,
    (CASE WHEN o.target_table='baptism' THEN ba.record_id ELSE cf.record_id END) record_id,
    (CASE WHEN o.target_table='baptism' THEN ba.identity_ok ELSE cf.identity_ok END) identity_ok
  FROM original o
  LEFT JOIN LATERAL (
   SELECT count(*)::int match_count,(array_agg(t.id ORDER BY t.id))[1] record_id,
      bool_and(
        length(btrim(coalesce(o.normalized_data->>'names','')))>0
        AND length(btrim(coalesce(o.normalized_data->>'last_names','')))>0
        AND length(btrim(coalesce(o.normalized_data->>'celebration_date','')))>0
        AND upper(btrim(coalesce(t.nombres,'')))=upper(btrim(o.normalized_data->>'names'))
        AND upper(btrim(coalesce(t.apellidos,'')))=upper(btrim(o.normalized_data->>'last_names'))
        AND t.celebration_date::text=o.normalized_data->>'celebration_date'
      ) identity_ok
   FROM public.baptisms t
   WHERE o.target_table='baptism' AND t.parish_id=o.parish_id
     AND btrim(coalesce(t.book_number,''))=btrim(coalesce(o.normalized_data->>'book_number',''))
     AND btrim(coalesce(t.folio,''))=btrim(coalesce(o.normalized_data->>'folio',''))
     AND btrim(coalesce(t.number,''))=btrim(coalesce(o.normalized_data->>'number',''))
  ) ba ON o.target_table='baptism'
  LEFT JOIN LATERAL (
   SELECT count(*)::int match_count,(array_agg(t.id ORDER BY t.id))[1] record_id,
      bool_and(
        length(btrim(coalesce(o.normalized_data->>'names','')))>0
        AND length(btrim(coalesce(o.normalized_data->>'last_names','')))>0
        AND length(btrim(coalesce(o.normalized_data->>'celebration_date','')))>0
        AND upper(btrim(coalesce(t.nombres,'')))=upper(btrim(o.normalized_data->>'names'))
        AND upper(btrim(coalesce(t.apellidos,'')))=upper(btrim(o.normalized_data->>'last_names'))
        AND t.celebration_date::text=o.normalized_data->>'celebration_date'
      ) identity_ok
   FROM public.confirmations t
   WHERE o.target_table='confirmation' AND t.parish_id=o.parish_id
     AND btrim(coalesce(t.book_number,''))=btrim(coalesce(o.normalized_data->>'book_number',''))
     AND btrim(coalesce(t.folio,''))=btrim(coalesce(o.normalized_data->>'folio',''))
     AND btrim(coalesce(t.number,''))=btrim(coalesce(o.normalized_data->>'number',''))
  ) cf ON o.target_table='confirmation'
 )
 SELECT
 CASE
  WHEN match_count=0 THEN 'not_found'
  WHEN match_count>1 THEN 'ambiguous'
  WHEN identity_ok IS TRUE THEN 'strong_candidate'
  ELSE 'identity_conflict'
 END AS assessment,
 CASE WHEN match_count=1 AND identity_ok IS TRUE THEN record_id ELSE NULL::uuid END AS candidate_id
 FROM candidate;
$body$;
-- Internal helper is deliberately not a public Data API endpoint.
REVOKE ALL ON FUNCTION public.sacramentum_missing_link_assessment_v219(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.assess_unresolved_legacy_links_v219(p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS TABLE(link_id uuid,assessment text,candidate_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $body$
BEGIN
 -- V218 already validates JWT, live Chancery, jurisdiction and pagination.
 RETURN QUERY SELECT base.link_id,a.assessment,a.candidate_id
 FROM public.list_unresolved_legacy_links_v218(NULL,p_limit,p_offset) base
 CROSS JOIN LATERAL public.sacramentum_missing_link_assessment_v219(base.link_id) a
 ORDER BY base.link_id;
END $body$;

CREATE OR REPLACE FUNCTION public.summarize_unresolved_legacy_candidates_v219()
RETURNS TABLE(assessment text,case_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $body$
DECLARE v_diocese uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING errcode='42501';END IF;
 SELECT up.diocese_id INTO v_diocese
 FROM public.user_profiles up
 JOIN public.chancelleries ch ON ch.id=up.chancery_id AND ch.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid()
  AND lower(up.role)='chancery'
  AND up.is_active IS TRUE
  AND upper(coalesce(up.status,''))='ACTIVE'
 LIMIT 1;
 IF v_diocese IS NULL THEN
  RAISE EXCEPTION 'Acceso exclusivo de Cancillería activa' USING errcode='42501';
 END IF;
 RETURN QUERY
 SELECT a.assessment,count(*)::bigint
 FROM public.legacy_record_links l
 JOIN public.legacy_import_batches b ON b.id=l.batch_id
 JOIN public.parishes p ON p.id=b.parish_id AND p.diocese_id=v_diocese
 JOIN public.legacy_import_rows r ON r.id=l.row_id AND r.batch_id=b.id
 LEFT JOIN public.baptisms ba ON l.target_table='baptism' AND ba.id=l.target_id
 LEFT JOIN public.confirmations cf ON l.target_table='confirmation' AND cf.id=l.target_id
 CROSS JOIN LATERAL public.sacramentum_missing_link_assessment_v219(l.id) a
 WHERE (l.target_table='baptism' AND ba.id IS NULL)
    OR (l.target_table='confirmation' AND cf.id IS NULL)
 GROUP BY a.assessment ORDER BY a.assessment;
END $body$;

REVOKE ALL ON FUNCTION public.assess_unresolved_legacy_links_v219(integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.summarize_unresolved_legacy_candidates_v219() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assess_unresolved_legacy_links_v219(integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.summarize_unresolved_legacy_candidates_v219() TO authenticated;
