-- V148 forensic: registry row change must advance updated_at (baptism/confirmation). ROLLBACK.
BEGIN;
DO $qa$
DECLARE v_parish uuid; v_b uuid; v_c uuid; v_before timestamptz; v_after timestamptz;
BEGIN
 SELECT parish_id INTO STRICT v_parish FROM public.user_profiles WHERE role='parish' AND is_active LIMIT 1;
 INSERT INTO public.baptisms(parish_id,status,nombres,apellidos,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated','QA-BEFORE','V148',DATE '2021-01-01','QA148','1','1','{"qaOnly":true}'::jsonb)
 RETURNING id,updated_at INTO v_b,v_before;
 PERFORM pg_sleep(0.06);
 UPDATE public.baptisms SET nombres='QA-AFTER' WHERE id=v_b RETURNING updated_at INTO v_after;
 IF v_before IS NOT DISTINCT FROM v_after THEN
   RAISE EXCEPTION 'V148-CONFIRMED: Baptism names changed but updated_at did not advance';
 END IF;
 INSERT INTO public.confirmations(parish_id,status,nombres,apellidos,celebration_date,book_number,folio,number,raw_data)
 VALUES(v_parish,'seated','QA-BEFORE','V148',DATE '2021-01-01','QA148','1','1','{"qaOnly":true}'::jsonb)
 RETURNING id,updated_at INTO v_c,v_before;
 PERFORM pg_sleep(0.06);
 UPDATE public.confirmations SET nombres='QA-AFTER' WHERE id=v_c RETURNING updated_at INTO v_after;
 IF v_before IS NOT DISTINCT FROM v_after THEN
   RAISE EXCEPTION 'V148-CONFIRMED: Confirmation names changed but updated_at did not advance';
 END IF;
END $qa$;
ROLLBACK;