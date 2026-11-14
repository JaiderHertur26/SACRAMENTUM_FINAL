-- Captura manual de las coordenadas de la primera partida de cada operación.
-- Cada verificación y cada asiento usan la misma fila de parámetros parroquiales.
CREATE OR REPLACE FUNCTION sacramentum_private.advance_seat_v328(
  p_params jsonb, p_prefix text, p_folio integer, p_number integer,
  p_capacity integer, p_restart boolean
) RETURNS TABLE(next_folio integer, next_number integer)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $sequence$
  SELECT
    p_folio + CASE WHEN p_restart AND p_number >= p_capacity + initial_reset_offset
                     OR NOT p_restart AND mod(p_number - first_number + 1, p_capacity) = 0
                  THEN 1 ELSE 0 END,
    CASE WHEN p_restart AND p_number >= p_capacity + initial_reset_offset
         THEN 1 ELSE p_number + 1 END
  FROM (
    SELECT coalesce((p_params->>(p_prefix || 'FirstNumber'))::integer, 1) AS first_number,
      CASE WHEN p_folio=(p_params->>(p_prefix || 'FirstFolio'))::integer
           THEN coalesce((p_params->>(p_prefix || 'FirstNumber'))::integer, 1)-1 ELSE 0 END AS initial_reset_offset
  ) configured;
$sequence$;

REVOKE ALL ON FUNCTION sacramentum_private.advance_seat_v328(jsonb,text,integer,integer,integer,boolean)
  FROM PUBLIC, anon, authenticated;

-- Reutiliza los cuatro escritores actuales con sus reglas sacramentales y el
-- mismo contrato de retorno. Las copias privadas sólo son llamadas por V328.
DO $install$
DECLARE
  item record;
  source text;
  header text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('seat_baptism_records', 'seat_baptism_records_v328', 'uuid,jsonb,integer,integer,integer', $before$    if v_restart then
      if v_number>=v_limit then
        v_folio:=v_folio+1;
        v_number:=1;
      else
        v_number:=v_number+1;
      end if;
    else
      v_number:=v_number+1;
      if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;$before$,
      $after$    SELECT s.next_folio, s.next_number INTO v_folio, v_number
    FROM sacramentum_private.advance_seat_v328(v_params,'ordinario',v_folio,v_number,v_limit,v_restart) s;
    if v_folio>9999 or v_number>9999 then raise exception 'El siguiente asiento excede el rango del libro configurado.'; end if;$after$, $old$  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then$old$, $new$  if v_book IS DISTINCT FROM p_expected_book or v_folio IS DISTINCT FROM p_expected_folio or v_number IS DISTINCT FROM p_expected_number then$new$),
    ('seat_confirmation_records', 'seat_confirmation_records_v328', 'uuid,jsonb,integer,integer,integer', $before$    if v_restart then
      if v_number>=v_limit then v_folio:=v_folio+1; v_number:=1; else v_number:=v_number+1; end if;
    else
      v_number:=v_number+1;
      if mod(v_number-1,v_limit)=0 then v_folio:=v_folio+1; end if;
    end if;$before$,
      $after$    SELECT s.next_folio, s.next_number INTO v_folio, v_number
    FROM sacramentum_private.advance_seat_v328(v_params,'ordinario',v_folio,v_number,v_limit,v_restart) s;
    if v_folio>9999 or v_number>9999 then raise exception 'El siguiente asiento excede el rango del libro configurado.'; end if;$after$, $old$  if v_book<>p_expected_book or v_folio<>p_expected_folio or v_number<>p_expected_number then$old$, $new$  if v_book IS DISTINCT FROM p_expected_book or v_folio IS DISTINCT FROM p_expected_folio or v_number IS DISTINCT FROM p_expected_number then$new$),
    ('seat_pending_marriage', 'seat_pending_marriage_v328', 'uuid', $before$  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio:=v_next_folio+1;
      v_next_number:=1;
    else
      v_next_number:=v_next_number+1;
    end if;
  else
    v_next_number:=v_next_number+1;
    if mod(v_next_number-1,v_limit)=0 then
      v_next_folio:=v_next_folio+1;
    end if;
  end if;$before$,
      $after$  SELECT s.next_folio, s.next_number INTO v_next_folio, v_next_number
  FROM sacramentum_private.advance_seat_v328(v_params,v_book_type,v_folio,v_number,v_limit,v_restart) s;
  if v_next_folio>9999 or v_next_number>9999 then raise exception 'El siguiente asiento excede el rango del libro configurado.'; end if;$after$, NULL::text, NULL::text),
    ('seat_funeral_record', 'seat_funeral_record_v328', 'jsonb,uuid', $before$  if v_restart then
    if v_next_number >= v_limit then
      v_next_folio := v_next_folio + 1;
      v_next_number := 1;
    else
      v_next_number := v_next_number + 1;
    end if;
  else
    v_next_number := v_next_number + 1;
    if mod(v_next_number - 1, v_limit) = 0 then
      v_next_folio := v_next_folio + 1;
    end if;
  end if;$before$,
      $after$  SELECT s.next_folio, s.next_number INTO v_next_folio, v_next_number
  FROM sacramentum_private.advance_seat_v328(v_params,v_book_type,v_folio,v_number,v_limit,v_restart) s;
  if v_next_folio>9999 or v_next_number>9999 then raise exception 'El siguiente asiento excede el rango del libro configurado.'; end if;$after$, NULL::text, NULL::text)
  ) AS writers(name, target, signature, before_text, after_text, null_check, null_safe)
  LOOP
    source:=replace(pg_get_functiondef(to_regprocedure('public.' || item.name || '(' || item.signature || ')')),chr(13)||chr(10),chr(10));
    IF source IS NULL OR strpos(source, item.before_text)=0
       OR strpos(substr(source, strpos(source, item.before_text)+length(item.before_text)), item.before_text)>0 THEN
      RAISE EXCEPTION 'Revisar la definición de % antes de instalar el escritor V328', item.name;
    END IF;
    header:='CREATE OR REPLACE FUNCTION public.' || item.name || '(';
    IF NOT starts_with(source, header) THEN RAISE EXCEPTION 'Firma inesperada para %', item.name; END IF;
    source:='CREATE OR REPLACE FUNCTION sacramentum_private.' || item.target || '(' || substr(source,length(header)+1);
    source:=replace(source,item.before_text,item.after_text);
    IF item.null_check IS NOT NULL THEN
      IF strpos(source,item.null_check)=0 THEN RAISE EXCEPTION 'Falta el cotejo de %',item.name; END IF;
      source:=replace(source,item.null_check,item.null_safe);
    END IF;
    EXECUTE source;
    EXECUTE format('REVOKE ALL ON FUNCTION sacramentum_private.%I(%s) FROM PUBLIC,anon,authenticated',
      item.target,item.signature);
  END LOOP;
END;
$install$;

CREATE OR REPLACE FUNCTION sacramentum_private.ordinary_seat_context_v328(
  p_parish_id uuid, p_sacrament text, p_pending_ids uuid[], p_lock boolean
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $context$
DECLARE
  parameter_column text;
  default_function text;
  registry_table text;
  pending_table text;
  defaults jsonb;
  parameters jsonb;
  target_type text;
  item record;
  book integer;
  folio integer;
  entry_number integer;
  capacity integer;
  restart boolean;
  started boolean;
  book_has_entries boolean;
  found_rows integer:=0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles u JOIN public.parishes p ON p.id=u.parish_id AND p.diocese_id=u.diocese_id
    WHERE u.auth_user_id=auth.uid() AND u.role='parish' AND u.is_active IS TRUE
      AND upper(u.status)='ACTIVE' AND u.parish_id=p_parish_id AND p.is_operational IS TRUE
  ) THEN
    RAISE EXCEPTION 'Sólo la parroquia activa y propietaria puede asentar estas boletas.' USING ERRCODE='42501';
  END IF;
  IF coalesce(cardinality(p_pending_ids),0) NOT BETWEEN 1 AND 500
     OR cardinality(p_pending_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_pending_ids) AS selected(id)) THEN
    RAISE EXCEPTION 'Seleccione de una a 500 boletas pendientes sin repetir.' USING ERRCODE='22023';
  END IF;

  SELECT v.params, v.registry, v.pending, v.defaults
    INTO parameter_column, registry_table, pending_table, default_function
  FROM (VALUES
    ('bautismo','bautizos_params','baptisms','pending_baptisms','sacramentum_default_baptism_params'),
    ('confirmacion','confirmaciones_params','confirmations','pending_confirmations','sacramentum_default_confirmation_params'),
    ('matrimonio','matrimonios_params','marriages','pending_marriages','sacramentum_default_marriage_params'),
    ('exequias','exequias_params','funerals','pending_funerals','sacramentum_default_funeral_params')
  ) AS v(sacrament, params, registry, pending, defaults)
  WHERE v.sacrament=p_sacrament;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sacramento no disponible para asentar.' USING ERRCODE='22023'; END IF;

  EXECUTE format('SELECT public.%I()',default_function) INTO defaults;
  IF p_lock THEN
    PERFORM public.sacramentum_ensure_parish_parameters(p_parish_id);
  END IF;
  EXECUTE format('SELECT %I FROM public.parish_parameters WHERE parish_id=$1 ORDER BY created_at NULLS LAST LIMIT 1%s',
    parameter_column, CASE WHEN p_lock THEN ' FOR UPDATE' ELSE '' END) INTO parameters USING p_parish_id;
  parameters:=defaults || coalesce(parameters,'{}'::jsonb);

  FOR item IN EXECUTE format(
    'SELECT id, status, reportado, raw_data, to_jsonb(p)->>''book_type'' AS book_type
     FROM public.%I p WHERE parish_id=$1 AND id=ANY($2) ORDER BY id%s',
     pending_table, CASE WHEN p_lock THEN ' FOR UPDATE' ELSE '' END
  ) USING p_parish_id,p_pending_ids LOOP
    IF lower(coalesce(item.status,''))<>'pending' OR coalesce(item.reportado,false) THEN
      RAISE EXCEPTION 'Una boleta seleccionada ya no está pendiente.';
    END IF;
    IF sacramentum_private.is_decree_pending_v325(item.id,p_sacrament,item.raw_data) THEN
      RAISE EXCEPTION 'El asiento de un decreto se realiza en Decretos por sentar.' USING ERRCODE='23514';
    END IF;
    IF p_sacrament IN ('matrimonio','exequias') THEN
      item.book_type:=lower(coalesce(nullif(trim(item.book_type),''),CASE WHEN p_sacrament='matrimonio' THEN nullif(trim(item.raw_data->>'bookType'),'') END,
        nullif(trim(item.raw_data->>'book_type'),''),nullif(trim(item.raw_data->>'bookType'),''),'ordinario'));
    ELSE
      item.book_type:='ordinario';
    END IF;
    IF item.book_type NOT IN ('ordinario','suplementario') OR
       (target_type IS NOT NULL AND target_type<>item.book_type) THEN
      RAISE EXCEPTION 'Seleccione boletas de un solo tipo de libro por lote.';
    END IF;
    target_type:=item.book_type;
    found_rows:=found_rows+1;
  END LOOP;
  IF found_rows<>cardinality(p_pending_ids) THEN
    RAISE EXCEPTION 'Una boleta seleccionada no está disponible en esta parroquia.';
  END IF;
  IF coalesce((parameters->>(target_type || 'Blocked'))::boolean,false) THEN
    RAISE EXCEPTION 'El libro % de este sacramento está bloqueado.',target_type;
  END IF;

  book:=greatest(1,coalesce(nullif(parameters->>(target_type || 'Libro'),'')::integer,1));
  folio:=greatest(1,coalesce(nullif(parameters->>(target_type || 'Folio'),'')::integer,1));
  entry_number:=greatest(1,coalesce(nullif(parameters->>(target_type || 'Numero'),'')::integer,1));
  capacity:=greatest(1,coalesce(nullif(parameters->>(target_type || 'Partidas'),'')::integer,2));
  restart:=coalesce((parameters->>(CASE WHEN target_type='ordinario'
    THEN 'ordinarioRestartNumber' ELSE 'suplementarioReiniciar' END))::boolean,false);
  EXECUTE format($used$
    SELECT EXISTS (
      SELECT 1 FROM public.%I r
      WHERE r.parish_id=$1 AND ltrim(r.book_number,'0')=$2::text
        AND coalesce(nullif(r.raw_data->>'book_type',''),nullif(to_jsonb(r)->>'book_type',''),'ordinario')=$3
    )$used$,registry_table) INTO book_has_entries USING p_parish_id,book,target_type;
  started:=book_has_entries OR parameters ? (target_type || 'FirstNumber') OR book<>1 OR folio<>1 OR entry_number<>1;
  RETURN jsonb_build_object('bookType',target_type,'book',book,'folio',folio,'number',entry_number,
    'capacity',capacity,'restart',restart,'initial',NOT started,
    'firstFolio',coalesce((parameters->>(target_type || 'FirstFolio'))::integer,1),
    'firstNumber',coalesce((parameters->>(target_type || 'FirstNumber'))::integer,1),'parameterColumn',parameter_column,'registryTable',registry_table);
END;
$context$;

REVOKE ALL ON FUNCTION sacramentum_private.ordinary_seat_context_v328(uuid,text,uuid[],boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_parish_seat_context_v328(
  p_parish_id uuid, p_sacrament text, p_pending_ids uuid[]
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $read$
  SELECT sacramentum_private.ordinary_seat_context_v328(p_parish_id,p_sacrament,p_pending_ids,false) - ARRAY['parameterColumn','registryTable']
$read$;

CREATE OR REPLACE FUNCTION public.seat_parish_records_v328(
  p_parish_id uuid, p_sacrament text, p_records jsonb, p_context jsonb, p_coordinates jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $write$
DECLARE
  pending_ids uuid[];
  context jsonb;
  target_type text;
  parameter_column text;
  book integer;
  folio integer;
  entry_number integer;
  capacity integer;
  restart boolean;
  record_data jsonb;
  result jsonb;
  seats integer:=0;
  book_has_entries boolean;
BEGIN
  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' OR coalesce(jsonb_array_length(p_records),0) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Seleccione de una a 500 boletas pendientes.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_coordinates) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM unnest(ARRAY['book','folio','number']) AS keys(key)
    WHERE NOT coalesce(p_coordinates->>key ~ '^[0-9]{1,4}$' AND (p_coordinates->>key)::integer>0,false)
  ) THEN
    RAISE EXCEPTION 'Indique Libro, Folio y Número para el primer asiento.' USING ERRCODE='22023';
  END IF;
  SELECT array_agg((r->>'pending_id')::uuid ORDER BY ord) INTO pending_ids
  FROM jsonb_array_elements(p_records) WITH ORDINALITY AS records(r,ord);

  -- Adquirir la fila antes de bloquear boletas mantiene el orden V204.
  context:=sacramentum_private.ordinary_seat_context_v328(p_parish_id,p_sacrament,pending_ids,true);
  IF p_context IS DISTINCT FROM (context - ARRAY['parameterColumn','registryTable']) THEN
    RAISE EXCEPTION 'Cambió la posición o la configuración del libro. Recargue antes de asentar.' USING ERRCODE='40001';
  END IF;
  target_type:=context->>'bookType';
  parameter_column:=context->>'parameterColumn';
  book:=(p_coordinates->>'book')::integer;
  folio:=(p_coordinates->>'folio')::integer;
  entry_number:=(p_coordinates->>'number')::integer;

  IF (context->>'initial')::boolean THEN
    IF NOT coalesce(p_coordinates->>'capacity' ~ '^[0-9]{1,4}$' AND (p_coordinates->>'capacity')::integer>0,false)
       OR jsonb_typeof(p_coordinates->'restart') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Indique Partidas por folio y la modalidad de numeración del libro.' USING ERRCODE='22023';
    END IF;
    -- Iniciar sólo un libro vacío. Un libro señalado con otro número puede
    -- contener partidas históricas y tener una capacidad que deba preservarse.
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I r WHERE r.parish_id=$1 AND ltrim(r.book_number,''0'')=$2::text
       AND coalesce(nullif(r.raw_data->>''book_type'',''''),nullif(to_jsonb(r)->>''book_type'',''''),''ordinario'')=$3)',
      context->>'registryTable') INTO book_has_entries USING p_parish_id,book,target_type;
    IF book_has_entries THEN
      RAISE EXCEPTION 'El Libro indicado ya contiene partidas. Use un libro sin asientos para inicializar la numeración.' USING ERRCODE='23514';
    END IF;
    capacity:=(p_coordinates->>'capacity')::integer;
    restart:=(p_coordinates->>'restart')::boolean;
    EXECUTE format('UPDATE public.parish_parameters SET %1$I=coalesce(%1$I,''{}''::jsonb) || $1
      WHERE parish_id=$2', parameter_column)
    USING jsonb_build_object(
      target_type || 'Libro',book,target_type || 'Folio',folio,target_type || 'Numero',entry_number,
      target_type || 'Partidas',capacity,target_type || 'FirstFolio',folio,target_type || 'FirstNumber',entry_number,
      CASE WHEN target_type='ordinario' THEN 'ordinarioRestartNumber' ELSE 'suplementarioReiniciar' END,restart
    ),p_parish_id;
  ELSIF (book,folio,entry_number) IS DISTINCT FROM
      ((context->>'book')::integer,(context->>'folio')::integer,(context->>'number')::integer) THEN
    RAISE EXCEPTION 'Libro, Folio y Número deben coincidir con el siguiente asiento del libro.' USING ERRCODE='23514';
  END IF;

  CASE p_sacrament
    WHEN 'bautismo' THEN
      SELECT to_jsonb(s) INTO STRICT result FROM sacramentum_private.seat_baptism_records_v328(p_parish_id,p_records,book,folio,entry_number) s;
    WHEN 'confirmacion' THEN
      SELECT to_jsonb(s) INTO STRICT result FROM sacramentum_private.seat_confirmation_records_v328(p_parish_id,p_records,book,folio,entry_number) s;
    WHEN 'matrimonio' THEN
      FOR record_data IN SELECT value FROM jsonb_array_elements(p_records) LOOP
        SELECT to_jsonb(s) INTO STRICT result FROM sacramentum_private.seat_pending_marriage_v328((record_data->>'pending_id')::uuid) s;
        seats:=seats+1;
      END LOOP;
      result:=result || jsonb_build_object('seated_count',seats);
    WHEN 'exequias' THEN
      IF cardinality(pending_ids)<>1 THEN RAISE EXCEPTION 'Seleccione una boleta de Exequias.'; END IF;
      SELECT to_jsonb(s) INTO STRICT result FROM sacramentum_private.seat_funeral_record_v328('{}'::jsonb,pending_ids[1]) s;
  END CASE;
  RETURN result;
END;
$write$;

REVOKE ALL ON FUNCTION public.get_parish_seat_context_v328(uuid,text,uuid[]),
  public.seat_parish_records_v328(uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parish_seat_context_v328(uuid,text,uuid[]),
  public.seat_parish_records_v328(uuid,text,jsonb,jsonb,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
