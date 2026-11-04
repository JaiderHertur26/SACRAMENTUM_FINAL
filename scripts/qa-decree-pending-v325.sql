-- Cada psql de CI abre su propia conexión; la identidad ficticia se fija aquí.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);

DO $qa$
DECLARE id_row uuid; sac text; t text; blocked boolean; n int; ordinary uuid:=gen_random_uuid(); checks int:=0;
BEGIN
 FOR sac,t IN SELECT * FROM (VALUES ('bautismo','pending_baptisms'),('confirmacion','pending_confirmations'),('matrimonio','pending_marriages'),('exequias','pending_funerals')) a(s,t)
 LOOP
  id_row:=gen_random_uuid();
  EXECUTE format('INSERT INTO public.%I(id,parish_id,status,raw_data) VALUES($1,$2,''pending'',$3)',t)
   USING id_row,'00000000-0000-4000-8000-000000000001'::uuid,'{"source":"new_sacrament","recordOrigin":"chancery_pending_seat_v287"}'::jsonb;
  blocked:=false;
  BEGIN
   CASE sac
    WHEN 'bautismo' THEN PERFORM public.seat_baptism_records('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('pending_id',id_row)),1,1,1);
    WHEN 'confirmacion' THEN PERFORM public.seat_confirmation_records('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('pending_id',id_row)),1,1,1);
    WHEN 'matrimonio' THEN PERFORM public.seat_pending_marriage(id_row);
    ELSE PERFORM public.seat_funeral_record('{}',id_row);
   END CASE;
  EXCEPTION WHEN check_violation THEN blocked:=position('V325:' in SQLERRM)>0; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Decreto admitido por RPC ordinario: %',sac; END IF;
  checks:=checks+1;
  -- Incluso al borrar los marcadores, la relación canónica bloquea el desvío.
  EXECUTE format('UPDATE public.%I SET raw_data=''{}'' WHERE id=$1',t) USING id_row;
  INSERT INTO public.decretos VALUES(gen_random_uuid(),sac,jsonb_build_object('pendingId',id_row));
  IF NOT sacramentum_private.is_decree_pending_v325(id_row,sac,'{}') THEN RAISE EXCEPTION 'No protege origen canónico'; END IF;
  checks:=checks+1;
 END LOOP;
 INSERT INTO public.pending_baptisms VALUES(ordinary,'00000000-0000-4000-8000-000000000001','pending',false,
  '{"source":"current_parish_registration","fechaSacramento":"2020-01-01","nombres":"PERSONA","apellidos":"ENSAYO"}');
 PERFORM public.seat_baptism_records('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('pending_id',ordinary,'assigned_book',1,'assigned_folio',1,'assigned_number',1)),1,1,1);
 SELECT count(*) INTO n FROM public.baptisms;
 IF n<>1 THEN RAISE EXCEPTION 'Se bloqueó el Bautismo ordinario legítimo'; END IF;
 checks:=checks+1;
 IF sacramentum_private.is_decree_pending_v325(gen_random_uuid(),'bautismo','{"source":"legacy_pre_registration"}') THEN RAISE EXCEPTION 'Se confundió boleta histórica con decreto'; END IF;
 checks:=checks+1;
 PERFORM set_config('v325.qa',jsonb_build_object('checks',checks,'blocked_ordinary_rpcs',4,'canonical_origin_protected',true,'ordinary_baptism_preserved',true)::text,false);
END $qa$;
SELECT current_setting('v325.qa')::jsonb AS result;
