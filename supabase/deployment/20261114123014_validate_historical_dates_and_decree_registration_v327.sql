-- Reserva el número interno de la boleta cuando se ejecuta un decreto de Cancillería.
-- La misma fila de parámetros serializa el consecutivo con las boletas parroquiales.
CREATE OR REPLACE FUNCTION sacramentum_private.reserve_decree_registration_v327(
  p_parish_id uuid, p_sacrament text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $counter$
DECLARE
  parameter_column text;
  pending_table text;
  registry_table text;
  minimum_width integer;
  parameters jsonb;
  current_number numeric;
  used_number numeric;
  used boolean;
  next_number numeric;
BEGIN
  SELECT x.params, x.pending, x.registry, x.width
    INTO STRICT parameter_column, pending_table, registry_table, minimum_width
  FROM (VALUES
    ('bautismo','bautizos_params','pending_baptisms','baptisms',6),
    ('confirmacion','confirmaciones_params','pending_confirmations','confirmations',6),
    ('matrimonio','matrimonios_params','pending_marriages','marriages',8),
    ('exequias','exequias_params','pending_funerals','funerals',6)
  ) AS x(sacrament, params, pending, registry, width)
  WHERE x.sacrament=p_sacrament;

  PERFORM public.sacramentum_ensure_parish_parameters(p_parish_id);
  EXECUTE format('SELECT coalesce(%I, ''{}''::jsonb) FROM public.parish_parameters
    WHERE parish_id=$1 FOR UPDATE', parameter_column) INTO STRICT parameters USING p_parish_id;

  current_number:=coalesce(nullif(regexp_replace(
    parameters->>'numeroRegistroActual','[^0-9]','','g'),'')::numeric,0);
  -- Confirmación y Matrimonio también toman en cuenta los folios importados
  -- al generar boletas ordinarias. Bautismo y Exequias usan el contador.
  IF p_sacrament IN ('confirmacion','matrimonio') THEN
    EXECUTE format($numbers$
      SELECT max(n::numeric) FROM (
        SELECT to_jsonb(r)->>'numero_registro' AS n FROM public.%1$I r WHERE r.parish_id=$1
        UNION ALL SELECT r.raw_data->>'numero_registro' FROM public.%1$I r WHERE r.parish_id=$1
        UNION ALL SELECT r.raw_data->>'numeroRegistro' FROM public.%1$I r WHERE r.parish_id=$1
        UNION ALL SELECT p.raw_data->>'numero_registro' FROM public.%2$I p WHERE p.parish_id=$1
        UNION ALL SELECT p.raw_data->>'numeroRegistro' FROM public.%2$I p WHERE p.parish_id=$1
      ) registrations WHERE n ~ '^[0-9]{1,30}$'
      $numbers$, registry_table,pending_table) INTO used_number USING p_parish_id;
    current_number:=greatest(current_number,coalesce(used_number,0));
  END IF;
  -- Los generadores ordinarios existentes admiten seis u ocho dígitos.
  -- Rechazar el agotamiento evita truncar y volver a entregar un número usado.
  next_number:=current_number+1;
  WHILE length(next_number::text)<=minimum_width LOOP
    EXECUTE format($used$
      SELECT EXISTS(
        SELECT 1 FROM public.%I r WHERE r.parish_id=$1
          AND $2 IN (to_jsonb(r)->>'numero_registro', r.raw_data->>'numero_registro', r.raw_data->>'numeroRegistro')
        UNION ALL
        SELECT 1 FROM public.%I p WHERE p.parish_id=$1
          AND $2 IN (to_jsonb(p)->>'numero_registro', p.raw_data->>'numero_registro', p.raw_data->>'numeroRegistro')
      )$used$,registry_table,pending_table) INTO used
      USING p_parish_id,lpad(next_number::text,minimum_width,'0');
    EXIT WHEN NOT used;
    next_number:=next_number+1;
  END LOOP;
  IF length(next_number::text)>minimum_width THEN
    RAISE EXCEPTION 'Se agotó el consecutivo interno de %',p_sacrament USING ERRCODE='22003';
  END IF;
  EXECUTE format('UPDATE public.parish_parameters SET %1$I=
    jsonb_set(coalesce(%1$I,''{}''::jsonb),''{numeroRegistroActual}'',to_jsonb($1::text),true),
    updated_at=clock_timestamp() WHERE parish_id=$2',parameter_column)
  USING lpad(next_number::text,minimum_width,'0'),p_parish_id;
  RETURN lpad(next_number::text,minimum_width,'0');
END;
$counter$;

REVOKE ALL ON FUNCTION sacramentum_private.reserve_decree_registration_v327(uuid,text)
  FROM PUBLIC, anon, authenticated;

-- Cada modificación conserva la firma, autorización y transacción existentes.
DO $patch$
DECLARE
  item record;
  definition text;
  first_pos integer;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    (1, 'public.register_historical_baptism(uuid,jsonb)', $before$  if v_celebration > current_date then
    raise exception 'Una partida histórica no puede tener fecha de Bautismo futura';
  end if;$before$,
     $after$  PERFORM sacramentum_private.require_completed_celebration_v326(v_celebration, NULL, 'el Bautismo histórico');$after$),
    (2, 'public.register_historical_confirmation(uuid,jsonb,uuid,text)', $before$  if v_celebration > current_date then raise exception 'Una Confirmación histórica no puede tener fecha futura'; end if;$before$,
     $after$  PERFORM sacramentum_private.require_completed_celebration_v326(v_celebration, NULL, 'la Confirmación histórica');$after$),
    (3, 'public.register_historical_marriage(uuid,jsonb)', $before$  if v_date is null then raise exception 'La fecha de Matrimonio es obligatoria'; end if;$before$,
     $after$  if v_date is null then raise exception 'La fecha de Matrimonio es obligatoria'; end if;
  PERFORM sacramentum_private.require_completed_celebration_v326(v_date, NULL, 'el Matrimonio histórico');$after$),
    (4, 'public.register_historical_funeral(uuid,jsonb)', $before$  if v_death is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;$before$,
     $after$  if v_death is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;
  PERFORM sacramentum_private.require_completed_celebration_v326(
    coalesce(v_funeral, v_death), NULL, 'la inscripción histórica de Exequias'
  );$after$),
    (5, 'sacramentum_ledger.real_seat_v263(uuid,text,uuid,bigint,integer,integer,uuid,jsonb)', $before$   IF to_char(v_date,'YYYY-MM-DD')<>v_date_text OR v_date>current_date THEN
     RAISE EXCEPTION 'V263: celebración posterior a hoy'; END IF;$before$,
     $after$   IF to_char(v_date,'YYYY-MM-DD')<>v_date_text THEN
     RAISE EXCEPTION 'V263: fecha imposible';
   END IF;
   PERFORM sacramentum_private.require_completed_celebration_v326(
     v_date,
     coalesce(
       nullif(v_pending->>'hora',''),
       nullif(v_raw->>'horaSacramento',''),
       nullif(v_raw->>'hora_sacramento',''),
       nullif(v_raw->>'hora_exequias',''),
       nullif(v_raw->>'hora_matrimonio',''),
       nullif(v_raw->>'hora',''),
       substring(v_raw->>'fechaHoraPrevista' from 'T([0-9]{2}:[0-9]{2}(?::[0-9]{2})?)')
     )::time,
     'la partida del libro'
   );$after$),
    (6, 'sacramentum_ledger.real_seat_v263(uuid,text,uuid,bigint,integer,integer,uuid,jsonb)', $before$   IF v_registration IS NULL OR v_registration !~ '^[0-9]{1,30}$' THEN$before$,
     $after$   IF v_registration IS NULL AND evidence.origin='new_decree_supplement' THEN
     v_registration:=sacramentum_private.reserve_decree_registration_v327(p_parish_id,p_sacrament);
   END IF;
   IF v_registration IS NULL OR v_registration !~ '^[0-9]{1,30}$' THEN$after$),
    (7, 'sacramentum_ledger.real_seat_v263(uuid,text,uuid,bigint,integer,integer,uuid,jsonb)', $before$          ''book_number'',$2,''folio'',$3,''number'',$4)
      WHERE id=$5 AND parish_id=$6 AND status=''pending''
        AND coalesce(reportado,false)=false',v_pending_table)
   USING v_record,v_book,lpad(v_folio::text,4,'0'),
     lpad(v_partida::text,4,'0'),v_pending_id,p_parish_id;$before$,
     $after$          ''book_number'',$2,''folio'',$3,''number'',$4,
          ''numero_registro'',$7,''numeroRegistro'',$7)
      WHERE id=$5 AND parish_id=$6 AND status=''pending''
        AND coalesce(reportado,false)=false',v_pending_table)
   USING v_record,v_book,lpad(v_folio::text,4,'0'),
     lpad(v_partida::text,4,'0'),v_pending_id,p_parish_id,v_current->>'registration_number';$after$),
    (8, 'public.seat_chancery_decree_v280(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid)', $before$ -- Bloquea TODOS los decretos de esta parroquia; imposibilita carreras de orden.
 PERFORM 1 FROM public.parishes WHERE id=p FOR UPDATE;$before$,
     $after$ -- Mantiene el orden de bloqueo que usan las boletas y asientos parroquiales.
 PERFORM public.sacramentum_ensure_parish_parameters(p);
 PERFORM 1 FROM public.parish_parameters pp WHERE pp.parish_id=p FOR UPDATE;
 -- Bloquea TODOS los decretos de esta parroquia; imposibilita carreras de orden.
 PERFORM 1 FROM public.parishes WHERE id=p FOR UPDATE;$after$)
  ) AS patches(step, signature, before_text, after_text) ORDER BY step
  LOOP
    definition:=replace(pg_get_functiondef(to_regprocedure(item.signature)),chr(13)||chr(10),chr(10));
    IF definition IS NULL THEN
      RAISE EXCEPTION 'Falta la operación %',item.signature;
    END IF;
    IF strpos(definition,item.after_text)>0 THEN CONTINUE; END IF;
    first_pos:=strpos(definition,item.before_text);
    IF first_pos=0 OR strpos(substr(definition,first_pos+length(item.before_text)),item.before_text)>0 THEN
      RAISE EXCEPTION 'Revisar la definición de % antes del cambio %',item.signature,item.step;
    END IF;
    EXECUTE replace(definition,item.before_text,item.after_text);
  END LOOP;
END;
$patch$;
