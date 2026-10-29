BEGIN;
-- V291: búsqueda paginada por el asiento del sacramento celebrado, sin descargar el padrón.
-- El único ámbito posible es la parroquia autenticada y operativa.
CREATE FUNCTION public.search_celebrated_sacramental_records_v291(
 p_sacrament text,
 p_query text DEFAULT '',
 p_book text DEFAULT '',
 p_folio text DEFAULT '',
 p_number text DEFAULT '',
 p_date date DEFAULT NULL,
 p_offset integer DEFAULT 0,
 p_limit integer DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_parish uuid; v_rows jsonb; v_total integer;
 v_query text:=btrim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
 v_book text:=upper(btrim(coalesce(p_book,'')));
 v_folio text:=btrim(coalesce(p_folio,''));
 v_number text:=btrim(coalesce(p_number,''));
 v_offset integer:=coalesce(p_offset,0);
 v_limit integer:=coalesce(p_limit,15);
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'V291: requiere autenticación parroquial' USING ERRCODE='42501';
 END IF;
 IF p_sacrament NOT IN ('matrimonio','confirmacion')
    OR v_offset<0 OR v_offset>200000 OR v_limit<1 OR v_limit>30
    OR length(v_query)>120 OR length(v_book)>32
    OR length(v_folio)>32 OR length(v_number)>32
    OR (length(v_query)=1 AND v_book='' AND v_folio='' AND v_number='' AND p_date IS NULL)
 THEN RAISE EXCEPTION 'V291: criterios o paginación inválidos' USING ERRCODE='22023'; END IF;
 SELECT up.parish_id INTO v_parish
 FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=auth.uid() AND up.role='parish'
 AND up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
 AND p.is_operational IS TRUE
 ORDER BY up.id LIMIT 1;
 IF v_parish IS NULL THEN
   RAISE EXCEPTION 'V291: parroquia no autorizada' USING ERRCODE='42501';
 END IF;
 WITH records AS (
 SELECT m.id,m.parish_id,m.celebration_date,m.book_number,m.folio,m.number,m.status,
   coalesce(nullif(m.raw_data->>'novioNombres',''),m.raw_data->>'nombr1','') as first_names,
   coalesce(nullif(m.raw_data->>'novioApellidos',''),m.raw_data->>'apell1','') as first_surnames,
   coalesce(nullif(m.raw_data->>'noviaNombres',''),m.raw_data->>'nombr2','') as second_names,
   coalesce(nullif(m.raw_data->>'noviaApellidos',''),m.raw_data->>'apell2','') as second_surnames
 FROM public.marriages m WHERE p_sacrament='matrimonio' AND m.parish_id=v_parish
 UNION ALL
 SELECT c.id,c.parish_id,c.celebration_date,c.book_number,c.folio,c.number,c.status,
   coalesce(c.nombres,''),coalesce(c.apellidos,''),''::text,''::text
 FROM public.confirmations c WHERE p_sacrament='confirmacion' AND c.parish_id=v_parish
 ), eligible AS (
 SELECT r.*
 FROM records r
 WHERE r.celebration_date IS NOT NULL AND r.celebration_date<=current_date
   AND nullif(btrim(coalesce(r.book_number,'')),'') IS NOT NULL
   AND nullif(btrim(coalesce(r.folio,'')),'') IS NOT NULL
   AND nullif(btrim(coalesce(r.number,'')),'') IS NOT NULL
   AND lower(coalesce(r.status,'seated')) NOT IN
   ('anulada','annulled','deleted','reversed','revertida','cancelled','replaced')
   AND length(btrim(concat_ws(' ',r.first_names,r.first_surnames)))>=4
   AND (p_sacrament='confirmacion' OR length(btrim(concat_ws(' ',r.second_names,r.second_surnames)))>=4)
   AND (v_book='' OR upper(regexp_replace(r.book_number,'^0+','','g'))=regexp_replace(v_book,'^0+','','g'))
   AND (v_folio='' OR regexp_replace(r.folio,'^0+','','g')=regexp_replace(v_folio,'^0+','','g'))
   AND (v_number='' OR regexp_replace(r.number,'^0+','','g')=regexp_replace(v_number,'^0+','','g'))
   AND (p_date IS NULL OR r.celebration_date=p_date)
   AND (v_query='' OR NOT EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(lower(v_query),'[[:space:]]+')) part
      WHERE position(part IN lower(concat_ws(' ',r.first_names,r.first_surnames,r.second_names,r.second_surnames)))=0
   ))
 ), chosen AS (
 SELECT * FROM eligible ORDER BY celebration_date DESC,id DESC LIMIT v_limit+1 OFFSET v_offset
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',z.id,'parish_id',z.parish_id,'celebration_date',z.celebration_date,
   'book_number',z.book_number,'folio',z.folio,'number',z.number,'status',z.status,
   'nombres',z.first_names,'apellidos',z.first_surnames,
   'raw_data',CASE WHEN p_sacrament='matrimonio' THEN jsonb_build_object(
      'novioNombres',z.first_names,'novioApellidos',z.first_surnames,
      'noviaNombres',z.second_names,'noviaApellidos',z.second_surnames)
      ELSE '{}'::jsonb END)
  ORDER BY z.celebration_date DESC,z.id DESC),'[]'::jsonb)
 INTO v_rows
 FROM (SELECT * FROM chosen LIMIT v_limit) z;
 SELECT count(*) INTO v_total FROM (
   WITH records AS (
      SELECT m.id,m.parish_id,m.celebration_date,m.book_number,m.folio,m.number,m.status,
        coalesce(nullif(m.raw_data->>'novioNombres',''),m.raw_data->>'nombr1','') first_names,
        coalesce(nullif(m.raw_data->>'novioApellidos',''),m.raw_data->>'apell1','') first_surnames,
        coalesce(nullif(m.raw_data->>'noviaNombres',''),m.raw_data->>'nombr2','') second_names,
        coalesce(nullif(m.raw_data->>'noviaApellidos',''),m.raw_data->>'apell2','') second_surnames
      FROM public.marriages m WHERE p_sacrament='matrimonio' AND m.parish_id=v_parish
      UNION ALL
      SELECT c.id,c.parish_id,c.celebration_date,c.book_number,c.folio,c.number,c.status,
        coalesce(c.nombres,''),coalesce(c.apellidos,''),''::text,''::text
      FROM public.confirmations c WHERE p_sacrament='confirmacion' AND c.parish_id=v_parish
   )
   SELECT id FROM records r
   WHERE r.celebration_date IS NOT NULL AND r.celebration_date<=current_date
   AND nullif(btrim(coalesce(r.book_number,'')),'') IS NOT NULL
   AND nullif(btrim(coalesce(r.folio,'')),'') IS NOT NULL
   AND nullif(btrim(coalesce(r.number,'')),'') IS NOT NULL
   AND lower(coalesce(r.status,'seated')) NOT IN ('anulada','annulled','deleted','reversed','revertida','cancelled','replaced')
   AND length(btrim(concat_ws(' ',r.first_names,r.first_surnames)))>=4
   AND (p_sacrament='confirmacion' OR length(btrim(concat_ws(' ',r.second_names,r.second_surnames)))>=4)
   AND (v_book='' OR upper(regexp_replace(r.book_number,'^0+','','g'))=regexp_replace(v_book,'^0+','','g'))
   AND (v_folio='' OR regexp_replace(r.folio,'^0+','','g')=regexp_replace(v_folio,'^0+','','g'))
   AND (v_number='' OR regexp_replace(r.number,'^0+','','g')=regexp_replace(v_number,'^0+','','g'))
   AND (p_date IS NULL OR r.celebration_date=p_date)
   AND (v_query='' OR NOT EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(lower(v_query),'[[:space:]]+')) part
      WHERE position(part IN lower(concat_ws(' ',r.first_names,r.first_surnames,r.second_names,r.second_surnames)))=0
   ))
 ) t;
 RETURN jsonb_build_object('items',v_rows,'total',v_total,'offset',v_offset,
   'hasMore',v_offset+jsonb_array_length(v_rows)<v_total);
END $fn$;
REVOKE ALL ON FUNCTION public.search_celebrated_sacramental_records_v291(
text,text,text,text,text,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_celebrated_sacramental_records_v291(
text,text,text,text,text,date,integer,integer) TO authenticated;
COMMIT;
