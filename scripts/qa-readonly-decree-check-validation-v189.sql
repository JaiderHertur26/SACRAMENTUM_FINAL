-- SACRAMENTUM V189: integridad jurídica de catálogo, exclusiva lectura y ROLLBACK.
BEGIN READ ONLY;
DO $qa$
DECLARE v_count integer;v_invalid integer;v_decrees bigint;v_bad_types bigint;v_bad_status bigint;v_null_type bigint;
BEGIN
 SELECT count(*)::integer,count(*) FILTER(WHERE NOT convalidated)::integer
 INTO v_count,v_invalid
 FROM pg_constraint
 WHERE conrelid='public.decretos'::regclass
   AND conname IN ('chk_decretos_sacrament_type','chk_decretos_status')
   AND contype='c';
 IF v_count<>2 OR v_invalid<>0 THEN RAISE EXCEPTION 'V189 invalid decree constraints: found %, pending %',v_count,v_invalid; END IF;
 SELECT count(*)::bigint,
   count(*) FILTER(WHERE sacrament_type IS NOT NULL
     AND sacrament_type NOT IN ('bautismo','confirmacion','matrimonio','exequias'))::bigint,
   count(*) FILTER(WHERE status NOT IN ('active','archived','cancelled','reversed') OR status IS NULL)::bigint,
   count(*) FILTER(WHERE sacrament_type IS NULL)::bigint
 INTO v_decrees,v_bad_types,v_bad_status,v_null_type FROM public.decretos;
 IF v_bad_types<>0 OR v_bad_status<>0 OR v_null_type<>0 THEN
   RAISE EXCEPTION 'V189 invalid decree states: types %, statuses %, nullable %',v_bad_types,v_bad_status,v_null_type;
 END IF;
 SELECT count(*)::integer INTO v_invalid FROM pg_constraint
 WHERE connamespace='public'::regnamespace AND NOT convalidated;
 IF v_invalid<>0 THEN RAISE EXCEPTION 'V189 unvalidated public constraints: %',v_invalid; END IF;
 PERFORM set_config('qa189.evidence',jsonb_build_object(
  'decree_checks_validated',v_count,
  'decree_rows_reviewed',v_decrees,
  'invalid_type_values',v_bad_types,
  'invalid_status_values',v_bad_status,
  'unvalidated_public_constraints',v_invalid,
  'no_existing_rows_modified',true
 )::text,true);
END $qa$;
SELECT current_setting('qa189.evidence')::jsonb AS qa_result;
ROLLBACK;