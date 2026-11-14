-- Las dos pruebas siempre revierten las filas ficticias y los consecutivos.
BEGIN;
SET LOCAL statement_timeout='20000ms';
SET LOCAL lock_timeout='4s';
DO $qa$
DECLARE
 actor uuid;
 parish uuid;
 sample record;
 t record;
 doc jsonb;
 book text:='QA326-'||left(gen_random_uuid()::text,8);
 valid int:=0;
 time_results jsonb:='{}'::jsonb;
 before_params jsonb;
 after_params jsonb;
 future_date date:=(statement_timestamp() AT TIME ZONE 'America/Bogota')::date+1;
 original_date date:=date '1995-11-20';
BEGIN
 SELECT auth_user_id,parish_id INTO STRICT actor,parish
 FROM public.user_profiles WHERE role='parish' AND is_active AND upper(status)='ACTIVE' LIMIT 1;
 SELECT to_jsonb(params) INTO STRICT before_params FROM public.parish_parameters params WHERE parish_id=parish;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 FOR sample IN SELECT * FROM (VALUES
   ('bautismo','register_historical_baptism'),
   ('confirmacion','register_historical_confirmation'),
   ('matrimonio','register_historical_marriage'),
   ('exequias','register_historical_funeral')
 ) AS tests(module, rpc)
 LOOP
  doc:=jsonb_build_object('Libro',book,'book_number',book,'folio','192','numero','74',
   'nombres','PERSONA','apellidos','FICTICIA V326','novioNombres','PERSONA','novioApellidos','FICTICIA V326',
   'noviaNombres','PERSONA DOS','noviaApellidos','FICTICIA V326','fechaSacramento',original_date::text,
   'celebration_date',original_date::text,'fecha_exequias',original_date::text,
   'fecha_defuncion',(original_date-3)::text,'hora_exequias','12:30','book_type','ordinario');
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SELECT * FROM public.%I($1,$2)',sample.rpc) INTO STRICT t USING parish,doc;
  EXECUTE 'RESET ROLE';
  IF t.record_id IS NULL OR upper(t.book_number)<>upper(book) OR ltrim(t.folio,'0')<>'192'
     OR ltrim(t.number,'0')<>'74' THEN
    RAISE EXCEPTION 'Coordenadas históricas no conservadas en % (% % %)',sample.module,t.book_number,t.folio,t.number;
  END IF;
  valid:=valid+1;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
   EXECUTE format('SELECT * FROM public.%I($1,$2)',sample.rpc) INTO STRICT t USING parish,
   doc||jsonb_build_object('fechaSacramento',future_date::text,'celebration_date',future_date::text,
   'fecha_exequias',future_date::text,'numero','75');
   RAISE EXCEPTION 'Se permitió una fecha posterior a la fecha civil del ensayo en %',sample.module;
  EXCEPTION WHEN OTHERS THEN
   IF SQLSTATE <> '23514' OR SQLERRM NOT ILIKE '%antes de su celebración%' THEN RAISE; END IF;
   time_results:=time_results||jsonb_build_object(sample.module,'rejected');
  END;
  EXECUTE 'RESET ROLE';
 END LOOP;
 SELECT to_jsonb(params) INTO STRICT after_params FROM public.parish_parameters params WHERE parish_id=parish;
 IF before_params IS DISTINCT FROM after_params THEN RAISE EXCEPTION 'Se movió un consecutivo ordinario'; END IF;
 PERFORM set_config('qa326.history',jsonb_build_object('valid',valid,'original_coordinates',valid,'future',time_results,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa326.history')::jsonb AS result;
ROLLBACK;

BEGIN;
SET LOCAL statement_timeout='30000ms';
SET LOCAL lock_timeout='4s';
DO $qa$
DECLARE
  parish uuid;
  district uuid;
  parish_actor uuid;
  chancery_actor uuid;
  signer text;
  concept uuid;
  module record;
  issued jsonb;
  seated jsonb;
  expected_record uuid;
  notice uuid;
  pending_id uuid;
  existing_book record;
  book_code text;
  book_id uuid;
  folio integer;
  number_in_book integer;
  capacity integer;
  restart_number boolean;
  book_version bigint;
  candidate_date date;
  pending_data jsonb;
  record_data jsonb;
  current_params jsonb;
  prior_params jsonb;
  rejected boolean;
  done integer:=0;
  before_pending jsonb;
BEGIN
  SELECT p.id,p.diocese_id,up.auth_user_id,ch.auth_user_id,
    CASE WHEN nullif(btrim(c.chancellor_name),'') IS NOT NULL THEN 'canciller' ELSE 'vice_canciller' END
  INTO STRICT parish,district,parish_actor,chancery_actor,signer
  FROM public.parishes p
  JOIN public.user_profiles up ON up.parish_id=p.id AND up.diocese_id=p.diocese_id
    AND up.role='parish' AND up.is_active AND upper(up.status)='ACTIVE'
  JOIN public.user_profiles ch ON ch.diocese_id=p.diocese_id AND ch.role='chancery'
    AND ch.is_active AND upper(ch.status)='ACTIVE'
  JOIN public.chancelleries c ON c.diocese_id=p.diocese_id AND (ch.chancery_id IS NULL OR c.id=ch.chancery_id)
  WHERE p.is_operational IS TRUE AND coalesce(nullif(btrim(c.chancellor_name),''),nullif(btrim(c.vice_chancellor_name),'')) IS NOT NULL
  ORDER BY p.id LIMIT 1;
  SELECT coalesce(min(d.decree_date)-1,date '1990-01-01') INTO candidate_date
  FROM public.decretos d WHERE d.parish_id=parish AND d.status='active' AND d.replacement_record_id IS NULL;

  FOR module IN SELECT * FROM (VALUES
    ('bautismo','pending_baptisms','baptisms','bautizos_params'),
    ('confirmacion','pending_confirmations','confirmations','confirmaciones_params'),
    ('matrimonio','pending_marriages','marriages','matrimonios_params'),
    ('exequias','pending_funerals','funerals','exequias_params')
  ) AS modules(sacrament,pending_table,registry_table,parameter_column)
  LOOP
    SELECT c.id INTO STRICT concept FROM public.conceptos_anulacion c
    WHERE c.diocese_id=district AND c.is_active AND c.enlibro=2 AND c.seinscribe
      AND lower(c.tipo) IN ('reposicion','porreposicion')
      AND lower(c.sacrament_type) IN (module.sacrament,'general') LIMIT 1;

    PERFORM set_config('request.jwt.claim.sub',chancery_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',chancery_actor,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    issued:=public.issue_chancery_form_decree_v294(parish,module.sacrament,'reposicion',NULL,
      concept,'QA-V327-'||gen_random_uuid()::text,candidate_date,'PERSONA FICTICIA PRUEBA V327',
      'Prueba reversible de decreto y asiento parroquial con numeración física',
      'QA-V327-CONSTANCIA',jsonb_build_object('nombres','PERSONA','apellidos','FICTICIA V327',
      'novioNombres','PERSONA','novioApellidos','FICTICIA V327','noviaNombres','PERSONA DOS',
      'noviaApellidos','FICTICIA V327','fechaSacramento',date '1980-01-01',
      'fecha_defuncion',date '1979-12-30','book_number','999','folio','999','number','999'),
      '{}'::jsonb,signer);
    EXECUTE 'RESET ROLE';

    notice:=(issued->>'notificationId')::uuid;
    pending_id:=(issued->>'pendingId')::uuid;
    SELECT to_jsonb(pp) INTO STRICT prior_params FROM public.parish_parameters pp WHERE pp.parish_id=parish;
    EXECUTE format('SELECT raw_data FROM public.%I WHERE id=$1',module.pending_table) INTO STRICT before_pending USING pending_id;
    IF before_pending ?| ARRAY['book_number','folio','number','numeroRegistro','numero_registro'] THEN
      RAISE EXCEPTION 'Se anticipó numeración al emitir el decreto %',module.sacrament;
    END IF;

    book_id:=NULL;
    book_code:='QA327'||upper(left(replace(gen_random_uuid()::text,'-',''),8));
    book_version:=0;
    folio:=41;
    number_in_book:=900;
    capacity:=2;
    restart_number:=false;
    SELECT m.* INTO existing_book FROM sacramentum_ledger.book_memories m
     WHERE m.parish_id=parish AND m.sacrament=module.sacrament AND m.book_type='suplementario'
       AND m.closed_at IS NULL AND m.retired_at IS NULL;
    IF FOUND THEN
      book_id:=existing_book.id;
      book_code:=existing_book.book_code;
      book_version:=existing_book.version;
      capacity:=existing_book.partidas_per_folio;
      restart_number:=existing_book.restart_partida_each_folio;
      folio:=existing_book.first_folio+existing_book.active_count/capacity;
      number_in_book:=CASE WHEN restart_number AND existing_book.active_count>=capacity
        THEN 1+existing_book.active_count%capacity
        ELSE existing_book.first_partida+existing_book.active_count END;
    END IF;

    PERFORM set_config('request.jwt.claim.sub',parish_actor::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',parish_actor,'role','authenticated')::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.mark_official_notification_read(notice);
    rejected:=false;
    BEGIN
      PERFORM public.seat_chancery_decree_v280((issued->>'decreeId')::uuid,book_code,book_id,
        NULL,number_in_book,capacity,restart_number,book_version,gen_random_uuid());
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%Libro, Folio, Número%' THEN RAISE; END IF;
      rejected:=true;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'Se permitió asentar sin folio'; END IF;
    EXECUTE 'RESET ROLE';

    SELECT to_jsonb(pp) INTO STRICT current_params FROM public.parish_parameters pp WHERE pp.parish_id=parish;
    IF current_params IS DISTINCT FROM prior_params THEN RAISE EXCEPTION 'El rechazo consumió un consecutivo'; END IF;

    EXECUTE 'SET LOCAL ROLE authenticated';
    seated:=public.seat_chancery_decree_v280((issued->>'decreeId')::uuid,book_code,book_id,
      folio,number_in_book,capacity,restart_number,book_version,gen_random_uuid());
    EXECUTE 'RESET ROLE';
    expected_record:=(seated->>'recordId')::uuid;
    EXECUTE format('SELECT raw_data FROM public.%I WHERE id=$1 AND reportado IS TRUE AND status=''seated''',
      module.pending_table) INTO STRICT pending_data USING pending_id;

    EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND parish_id=$2',
      module.registry_table) INTO STRICT record_data USING expected_record,parish;
    SELECT to_jsonb(pp) INTO STRICT current_params FROM public.parish_parameters pp WHERE pp.parish_id=parish;

    IF (record_data->>'book_number') IS DISTINCT FROM book_code
      OR (record_data->>'folio')::integer IS DISTINCT FROM folio
      OR (record_data->>'number')::integer IS DISTINCT FROM number_in_book
      OR coalesce(pending_data->>'numero_registro','') !~ '^[0-9]+$'
      OR pending_data->>'numero_registro' IS DISTINCT FROM
        current_params->module.parameter_column->>'numeroRegistroActual'
      OR ((current_params->module.parameter_column) - 'numeroRegistroActual') IS DISTINCT FROM
        ((prior_params->module.parameter_column) - 'numeroRegistroActual')
      OR NOT EXISTS (SELECT 1 FROM public.official_notifications n WHERE n.id=notice AND n.status='processed')
      OR NOT EXISTS (SELECT 1 FROM sacramentum_ledger.chancery_decree_receipts_v280 r
        WHERE r.decree_id=(issued->>'decreeId')::uuid)
    THEN RAISE EXCEPTION 'El asiento de % no conservó sus coordenadas, aviso o constancia',module.sacrament; END IF;
    done:=done+1;
  END LOOP;
  PERFORM set_config('qa327.decrees',jsonb_build_object('seated',done,'required_coordinates',done,
    'registration_assigned',done,'closed_notices',done,'returned_receipts',done,'rollback',true)::text,true);
END $qa$;
SELECT current_setting('qa327.decrees')::jsonb AS result;
ROLLBACK;
