-- CI aislado: los asientos históricos se conservan y el cursor sólo avanza con una escritura válida.
BEGIN;
DO $qa$
DECLARE
  a uuid;
  p uuid;
  pending_id uuid:=gen_random_uuid();
  context jsonb;
  saved jsonb;
BEGIN
  SELECT u.auth_user_id,u.parish_id INTO STRICT a,p
  FROM public.user_profiles u JOIN public.parishes pa ON pa.id=u.parish_id
  WHERE u.role='parish' AND u.is_active AND upper(u.status)='ACTIVE' AND pa.is_operational LIMIT 1;
  UPDATE public.parish_parameters pp SET confirmaciones_params=coalesce(confirmaciones_params,'{}'::jsonb)
    || '{"ordinarioLibro":9991,"ordinarioFolio":1,"ordinarioNumero":2,"ordinarioPartidas":2,"ordinarioRestartNumber":false,"ordinarioBlocked":false}'::jsonb
  WHERE pp.parish_id=p;
  INSERT INTO public.confirmations(parish_id,book_number,folio,number,status,raw_data) VALUES
    (p,'9991','0001','0001','seated','{"source":"legacy_import"}'),
    (p,'9991','0001','0002','seated','{"source":"legacy_import"}'),
    (p,'9991','0002','0003','seated','{"source":"legacy_import"}'),
    (p,'9991','0002','0004','seated','{"source":"legacy_import"}');
  INSERT INTO public.pending_confirmations(id,parish_id,status,reportado,raw_data) VALUES
    (pending_id,p,'pending',false,'{"nombres":"PERSONA","apellidos":"FICTICIA V328","fechaSacramento":"1995-01-01","numeroRegistro":"000534","source":"current_parish_registration"}');
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  context:=public.get_parish_seat_context_v328(p,'confirmacion',ARRAY[pending_id]);
  RESET ROLE;
  IF context->>'folio'<>'3' OR context->>'number'<>'5' OR context->>'advanced'<>'true'
    OR (SELECT confirmaciones_params->>'ordinarioNumero' FROM public.parish_parameters WHERE parish_id=p)<>'2' THEN
    RAISE EXCEPTION 'La consulta no obtuvo el consecutivo libre o modificó el cursor';
  END IF;
  SET LOCAL ROLE authenticated;
  saved:=public.seat_parish_records_v328(p,'confirmacion',jsonb_build_array(jsonb_build_object('pending_id',pending_id)),
    context,'{"book":9991,"folio":3,"number":5}');
  RESET ROLE;
  IF saved->>'next_number'<>'6'
     OR (SELECT count(*) FROM public.confirmations r WHERE r.parish_id=p AND r.book_number='9991' AND r.raw_data->>'source'='legacy_import')<>4
     OR NOT EXISTS(SELECT 1 FROM public.confirmations r WHERE r.parish_id=p AND r.book_number='9991' AND r.folio='0003' AND r.number='0005') THEN
    RAISE EXCEPTION 'Numeración o partida histórica alterada durante la conciliación';
  END IF;
  PERFORM set_config('qa328.reconciliation',jsonb_build_object('unchanged_historical',4,'successor_verified',true,'rollback',true)::text,true);
END;
$qa$;
SELECT current_setting('qa328.reconciliation')::jsonb AS result;
ROLLBACK;
