BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE di uuid;vi uuid;deca uuid;pa uuid;pb uuid:=gen_random_uuid();ub uuid:=gen_random_uuid();
 ua uuid; uc uuid; ud uuid;n1 uuid;n2 uuid;n3 uuid;n4 uuid;
BEGIN
 SELECT p.diocese_id,p.vicary_id,p.decanate_id,p.id,u.auth_user_id INTO STRICT di,vi,deca,pa,ua
 FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id WHERE u.role='parish' AND u.is_active LIMIT 1;
 SELECT auth_user_id INTO STRICT uc FROM public.user_profiles WHERE role='chancery' AND is_active AND diocese_id=di LIMIT 1;
 SELECT auth_user_id INTO STRICT ud FROM public.user_profiles WHERE role='diocese' AND is_active AND diocese_id=di LIMIT 1;
 INSERT INTO public.parishes(id,name,diocese_id,vicary_id,decanate_id,is_operational)
 VALUES(pb,'QA V320 PRIVACIDAD PARROQUIAL',di,vi,deca,true);
 INSERT INTO auth.users(id,aud,role,is_anonymous) VALUES(ub,'authenticated','authenticated',false);
 INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status)
 VALUES(ub,pb,di,'parish',true,'ACTIVE');
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,status)
 VALUES(di,pa,'decree','QA V320 DECRETO PROPIO','pending') RETURNING id INTO n1;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,status)
 VALUES(di,pb,'decree','QA V320 DECRETO AJENO','pending') RETURNING id INTO n2;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,status)
 VALUES(di,pa,'general','QA V320 GENERAL PROPIA','pending') RETURNING id INTO n3;
 INSERT INTO public.official_notifications(diocese_id,receiver_parish_id,category,subject,status)
 VALUES(di,pb,'general','QA V320 GENERAL AJENA','pending') RETURNING id INTO n4;
 PERFORM set_config('qa320.a',ua::text,true);PERFORM set_config('qa320.b',ub::text,true);
 PERFORM set_config('qa320.c',uc::text,true);PERFORM set_config('qa320.d',ud::text,true);
 PERFORM set_config('qa320.own_decree',n1::text,true);PERFORM set_config('qa320.foreign_decree',n2::text,true);
 PERFORM set_config('qa320.own_general',n3::text,true);PERFORM set_config('qa320.foreign_general',n4::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE who text; u text; own_dec int; foreign_dec int; own_gen int; foreign_gen int;
BEGIN
 FOR who IN SELECT unnest(ARRAY['a','b','c','d']) LOOP
  u:=current_setting('qa320.'||who);
  PERFORM set_config('request.jwt.claim.sub',u,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  SELECT count(*) INTO own_dec FROM public.official_notifications WHERE id=current_setting('qa320.own_decree')::uuid;
  SELECT count(*) INTO foreign_dec FROM public.official_notifications WHERE id=current_setting('qa320.foreign_decree')::uuid;
  SELECT count(*) INTO own_gen FROM public.official_notifications WHERE id=current_setting('qa320.own_general')::uuid;
  SELECT count(*) INTO foreign_gen FROM public.official_notifications WHERE id=current_setting('qa320.foreign_general')::uuid;
  IF (who='a' AND (own_dec<>1 OR foreign_dec<>0 OR own_gen<>1 OR foreign_gen<>0))
     OR (who='b' AND (own_dec<>0 OR foreign_dec<>1 OR own_gen<>0 OR foreign_gen<>1))
     OR (who='c' AND (own_dec<>1 OR foreign_dec<>1 OR own_gen<>1 OR foreign_gen<>1))
     OR (who='d' AND (own_dec<>0 OR foreign_dec<>0 OR own_gen<>1 OR foreign_gen<>1))
  THEN RAISE EXCEPTION 'Privacy mismatch role % decree own/other %/% general own/other %/%',who,own_dec,foreign_dec,own_gen,foreign_gen; END IF;
 END LOOP;
 PERFORM set_config('qa320.result',jsonb_build_object('parish_own_only',true,'chancery_all_diocesan',true,'bishop_no_decrees',true,'bishop_general_notices',true,'rollback',true)::text,true);
END $verify$;
SELECT current_setting('qa320.result')::jsonb test;
ROLLBACK;