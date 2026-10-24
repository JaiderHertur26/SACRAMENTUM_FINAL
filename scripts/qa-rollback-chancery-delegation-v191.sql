-- V191 PostgreSQL QA: 6 delegated juridical RPCs x 4 invalid profile states.
-- SQL transaction reversible. Does not touch genuine decrees or sacramental rows.
BEGIN;
SET LOCAL statement_timeout='20000ms';
DO $qa$
DECLARE uid uuid; profile_id uuid; parish uuid; decree uuid; case_name text; operation_name text;
 message text; denied integer:=0; ok integer:=0;
BEGIN
 SELECT u.id,u.auth_user_id,p.id INTO STRICT profile_id,uid,parish
 FROM public.user_profiles u
 JOIN public.chancelleries ch ON ch.id=u.chancery_id AND ch.diocese_id=u.diocese_id
 JOIN public.parishes p ON p.diocese_id=u.diocese_id AND p.is_operational IS TRUE
 WHERE u.role='chancery' AND u.is_active IS TRUE AND upper(u.status)='ACTIVE'
 LIMIT 1;
 SELECT d.id INTO STRICT decree FROM public.decretos d
 JOIN public.user_profiles u ON u.id=profile_id AND u.diocese_id=d.diocese_id
 LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM public.sacramentum_assert_chancery_for_parish(parish);
 ok:=ok+1;
 FOREACH case_name IN ARRAY ARRAY['NULL_STATUS','SUSPENDED','NULL_ACTIVE','FALSE_ACTIVE'] LOOP
  UPDATE public.user_profiles SET
    status=CASE WHEN case_name='NULL_STATUS' THEN NULL WHEN case_name='SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
    is_active=CASE WHEN case_name='NULL_ACTIVE' THEN NULL WHEN case_name='FALSE_ACTIVE' THEN FALSE ELSE TRUE END
  WHERE id=profile_id;
  FOREACH operation_name IN ARRAY ARRAY['baptism_correction','baptism_replacement','confirmation_correction','confirmation_replacement','reverse_correction','reverse_replacement']
  LOOP
   BEGIN
    IF operation_name='baptism_correction' THEN
      PERFORM public.apply_baptism_correction(parish,NULL::uuid,NULL::text,NULL::date,NULL::uuid,NULL::jsonb,NULL::jsonb,
      NULL::text,NULL::text,NULL::integer,NULL::integer,NULL::integer);
    ELSIF operation_name='baptism_replacement' THEN
      PERFORM public.apply_baptism_replacement(parish,NULL::text,NULL::date,NULL::uuid,NULL::jsonb,NULL::jsonb,NULL::text,
      NULL::integer,NULL::integer,NULL::integer);
    ELSIF operation_name='confirmation_correction' THEN
      PERFORM public.apply_confirmation_correction(parish,NULL::uuid,NULL::text,NULL::date,NULL::uuid,NULL::jsonb,NULL::jsonb,
      NULL::text,NULL::text,NULL::integer,NULL::integer,NULL::integer);
    ELSIF operation_name='confirmation_replacement' THEN
      PERFORM public.apply_confirmation_replacement(parish,NULL::text,NULL::date,NULL::uuid,NULL::jsonb,NULL::jsonb,NULL::text,
      NULL::integer,NULL::integer,NULL::integer);
    ELSIF operation_name='reverse_correction' THEN
      PERFORM public.reverse_correction_decree_with_reason(decree,'Motivo ficticio V191');
    ELSE
      PERFORM public.reverse_replacement_decree_with_reason(decree,'Motivo ficticio V191');
    END IF;
    RAISE EXCEPTION 'QA191 invalid user reached juridical operation';
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
    IF message<>'Sólo Cancillería activa puede emitir o revertir decretos sacramentales' THEN
      RAISE EXCEPTION 'QA191 unexpected % under %: %',operation_name,case_name,message;
    END IF;
    denied:=denied+1;
   END;
  END LOOP;
 END LOOP;
 IF denied<>24 THEN RAISE EXCEPTION 'QA191 missing delegated authorization denials'; END IF;
 PERFORM set_config('qa191.matrix',jsonb_build_object('active_helper_allowed',ok,
  'juridical_wrappers',6,'invalid_profile_states',4,'denied_operations',denied,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa191.matrix')::jsonb AS qa_report;
ROLLBACK;
