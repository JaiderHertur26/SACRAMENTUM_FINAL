-- V192 · Canciller único activo + relevo permitido al suspender. Rollback.
BEGIN;
DO $qa$
DECLARE real_id uuid; ch uuid; di uuid; substitute_id uuid; denials integer:=0; idx text;
BEGIN
 SELECT id,chancery_id,diocese_id INTO STRICT real_id,ch,di
 FROM public.user_profiles WHERE role='chancery' AND is_active IS TRUE
 AND upper(status)='ACTIVE' LIMIT 1;
 BEGIN
  INSERT INTO public.user_profiles(id,role,diocese_id,chancery_id,status,is_active)
  VALUES(gen_random_uuid(),'chancery',di,ch,'ACTIVE',true);
  RAISE EXCEPTION 'V192 unexpected second active chancellor';
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS idx=CONSTRAINT_NAME;
  IF idx<>'uq_active_chancery_user' THEN RAISE;END IF;
  denials:=denials+1;
 END;
 UPDATE public.user_profiles SET status='SUSPENDED' WHERE id=real_id;
 substitute_id=gen_random_uuid();
 INSERT INTO public.user_profiles(id,role,diocese_id,chancery_id,status,is_active)
 VALUES(substitute_id,'chancery',di,ch,'ACTIVE',true);
 BEGIN
  UPDATE public.user_profiles SET status='ACTIVE' WHERE id=real_id;
  RAISE EXCEPTION 'V192 unexpected reactivation';
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS idx=CONSTRAINT_NAME;
  IF idx<>'uq_active_chancery_user' THEN RAISE;END IF;
  denials:=denials+1;
 END;
 BEGIN
  INSERT INTO public.user_profiles(id,role,diocese_id,chancery_id,status,is_active)
  VALUES(gen_random_uuid(),'chancery',di,ch,'ACTIVE',true);
  RAISE EXCEPTION 'V192 unexpected second replacement';
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS idx=CONSTRAINT_NAME;
  IF idx<>'uq_active_chancery_user' THEN RAISE;END IF;
  denials:=denials+1;
 END;
 IF denials<>3 THEN RAISE EXCEPTION 'V192 expected 3 duplicate denials';END IF;
 PERFORM set_config('qa192.chancellor',jsonb_build_object('duplicate_denials',denials,
 'successor_after_suspension',true,'no_changes_persist',true)::text,true);
END $qa$;
SELECT current_setting('qa192.chancellor')::jsonb AS result;
ROLLBACK;
