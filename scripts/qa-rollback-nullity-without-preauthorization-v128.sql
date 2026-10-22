-- V128 NEGATIVA: comprobar si Cancillería puede generar nulidad sin autorización judicial previa.
BEGIN;
DO $qa$
DECLARE v_actor uuid;v_parish uuid;v_marriage uuid;v_decree uuid;v_status text;v_number text:='QA-V128-'||substr(gen_random_uuid()::text,1,8);
BEGIN
 SELECT u.auth_user_id,p.id INTO STRICT v_actor,v_parish FROM public.user_profiles u JOIN public.parishes p ON p.diocese_id=u.diocese_id
 WHERE u.role='chancery' AND u.is_active ORDER BY p.is_operational DESC,p.id LIMIT 1;
 INSERT INTO public.marriages(parish_id,status,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated','2018-05-05','QA-V128','998','998',jsonb_build_object('qaOnly',true)) RETURNING id INTO v_marriage;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 SELECT decree_id INTO v_decree FROM public.apply_marriage_nullity(v_marriage,v_number,DATE '2025-04-21','Supuesta sentencia sin documentación validada','{"qaOnly":true}'::jsonb,NULL);
 SELECT status INTO v_status FROM public.marriages WHERE id=v_marriage;
 IF v_status='nullified' AND v_decree IS NOT NULL THEN
   RAISE EXCEPTION 'QA-V128-VULNERABLE: nulidad aplicada SIN evidencia judicial prevalidada';
 END IF;
END $qa$;
ROLLBACK;