-- V150 QA read-only: check valid roles without printing identity information.
-- Uses existing active user-profile references only to simulate a verified JWT.
-- No updates/inserts: all settings are LOCAL and every operation is rolled back.
BEGIN;
SELECT set_config('qa.parish_uid',(
  SELECT auth_user_id::text FROM public.user_profiles
  WHERE lower(role)='parish' AND auth_user_id IS NOT NULL AND coalesce(is_active,true)
  ORDER BY id LIMIT 1),true);
SELECT set_config('qa.parish_own',(
  SELECT parish_id::text FROM public.user_profiles
  WHERE lower(role)='parish' AND auth_user_id IS NOT NULL AND coalesce(is_active,true)
  ORDER BY id LIMIT 1),true);
SELECT set_config('qa.parish_other',(
  SELECT id::text FROM public.parishes
  WHERE id::text<>current_setting('qa.parish_own')
  ORDER BY id LIMIT 1),true);
SELECT set_config('qa.chancery_uid',(
  SELECT auth_user_id::text FROM public.user_profiles
  WHERE lower(role)='chancery' AND coalesce(is_active,true) LIMIT 1),true);
SELECT set_config('qa.admin_uid',(
  SELECT auth_user_id::text FROM public.user_profiles
  WHERE lower(role)='admin_general' AND coalesce(is_active,true) LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE
  v_own uuid:=current_setting('qa.parish_own')::uuid;
  v_other uuid:=current_setting('qa.parish_other')::uuid;
  v_uid text;
BEGIN
  IF v_own IS NULL OR v_other IS NULL THEN
    RAISE EXCEPTION 'V150 QA needs at least two parishes';
  END IF;
  v_uid:=current_setting('qa.parish_uid');
  PERFORM set_config('request.jwt.claim.sub',v_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  IF public.can_access_parish(v_own) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'V150 parish own access regressed';
  END IF;
  IF public.can_access_parish(v_other) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'V150 parish other access permitted';
  END IF;
  v_uid:=current_setting('qa.chancery_uid');
  PERFORM set_config('request.jwt.claim.sub',v_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  IF public.can_access_parish(v_own) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'V150 chancery scope regressed';
  END IF;
  v_uid:=current_setting('qa.admin_uid');
  PERFORM set_config('request.jwt.claim.sub',v_uid,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
  IF public.can_access_parish(v_own) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'V150 admin scope regressed';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000150',true);
  PERFORM set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000150","role":"authenticated"}',true);
  IF public.can_access_parish(v_own) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'V150 unknown profile was not rejected';
  END IF;
END $qa$;
ROLLBACK;
