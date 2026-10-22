-- V151: privilege matrix for actual authorized profiles and historical batches.
-- All effects are rolled back. No inserts or deletes persist.
BEGIN;
SELECT set_config('qa.batch_d',(
 SELECT b.id::text FROM public.legacy_import_batches b JOIN public.user_profiles up
 ON up.diocese_id=b.diocese_id AND lower(up.role)='diocese'
 AND coalesce(up.is_active,true) WHERE upper(b.profile_key) IN ('INSBAUTI','INSCONFI')
 ORDER BY b.id LIMIT 1),true);
SELECT set_config('qa.batch_p',(
 SELECT b.id::text FROM public.legacy_import_batches b JOIN public.user_profiles up
 ON up.parish_id=b.parish_id AND lower(up.role)='parish'
 AND coalesce(up.is_active,true) WHERE upper(b.profile_key) IN ('INSBAUTI','INSCONFI')
 ORDER BY b.id LIMIT 1),true);
SELECT set_config('qa.chancery_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='chancery' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.admin_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='admin_general' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.diocese_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='diocese' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.parish_uid',(SELECT auth_user_id::text FROM public.user_profiles
 WHERE lower(role)='parish' AND coalesce(is_active,true) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
 v_uid text;v_batch uuid;v_result jsonb;v_msg text;
 v_rejected int:=0;v_accepted int:=0;v_role text;
BEGIN
 FOR v_role IN SELECT unnest(array['chancery','admin']) LOOP
  v_uid:=current_setting('qa.'||v_role||'_uid');
  v_batch:=current_setting('qa.batch_d')::uuid;
  PERFORM set_config('request.jwt.claim.sub',v_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  BEGIN
   v_result:=public.materialize_pending_legacy_sacramental_records(v_batch,1);
   RAISE EXCEPTION 'V151-FAIL % materialized sacrament',v_role;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
   IF v_msg LIKE 'V151-FAIL%' THEN RAISE; END IF;
   IF v_msg NOT LIKE '%jurisdicci%n%' THEN RAISE EXCEPTION 'V151-FAIL different sacrament denial %',v_msg; END IF;
   v_rejected:=v_rejected+1;
  END;
  BEGIN
   v_result:=public.materialize_pending_legacy_marriages(v_batch,1);
   RAISE EXCEPTION 'V151-FAIL % materialized marriage',v_role;
  EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_msg=MESSAGE_TEXT;
   IF v_msg LIKE 'V151-FAIL%' THEN RAISE; END IF;
   IF v_msg NOT LIKE '%jurisdicci%n%' THEN RAISE EXCEPTION 'V151-FAIL different marriage denial %',v_msg; END IF;
   v_rejected:=v_rejected+1;
  END;
 END LOOP;
 FOR v_role IN SELECT unnest(array['diocese','parish']) LOOP
  v_uid:=current_setting('qa.'||v_role||'_uid');
  v_batch:=current_setting('qa.batch_'||case when v_role='diocese' then 'd' else 'p' end)::uuid;
  PERFORM set_config('request.jwt.claim.sub',v_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  v_result:=public.materialize_pending_legacy_sacramental_records(v_batch,1);
  IF v_result IS NULL OR (v_result->>'imported')::integer IS DISTINCT FROM 0 THEN
   RAISE EXCEPTION 'V151-FAIL expected no valid rows and zero imports';
  END IF;
  v_accepted:=v_accepted+1;
 END LOOP;
 IF v_rejected<>4 OR v_accepted<>2 THEN
  RAISE EXCEPTION 'V151-FAIL role matrix % rejected / % accepted',v_rejected,v_accepted;
 END IF;
END $qa$;
ROLLBACK;
