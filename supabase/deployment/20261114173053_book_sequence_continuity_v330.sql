-- Próxima ubicación física libre de un libro. La consulta conserva las partidas existentes.
CREATE OR REPLACE FUNCTION sacramentum_private.seat_position_occupied_v330(
  p_table text, p_parish_id uuid, p_book_type text, p_book text, p_folio integer, p_number integer
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $occupied$
DECLARE
  occupied boolean;
BEGIN
  IF p_table NOT IN ('baptisms','confirmations','marriages','funerals') THEN
    RAISE EXCEPTION 'Libro sacramental no disponible.' USING ERRCODE='22023';
  END IF;

  EXECUTE format($lookup$
    SELECT EXISTS(
      SELECT 1 FROM public.%I r
      WHERE r.parish_id=$1
        AND (CASE WHEN btrim(r.book_number) ~ '^[0-9]+$'
          THEN ltrim(btrim(r.book_number),'0') ELSE lower(btrim(r.book_number)) END)=$2
        AND ltrim(btrim(r.folio),'0')=$3::text AND ltrim(btrim(r.number),'0')=$4::text
        %s
    )
  $lookup$,p_table,CASE WHEN p_table IN ('marriages','funerals')
    THEN 'AND lower(coalesce(nullif(btrim(r.book_type),''''),''ordinario''))=$5' ELSE '' END)
  INTO occupied USING p_parish_id,
    CASE WHEN btrim(p_book) ~ '^[0-9]+$' THEN ltrim(btrim(p_book),'0') ELSE lower(btrim(p_book)) END,
    p_folio,p_number,p_book_type;
  RETURN occupied;
END;
$occupied$;

-- Al comenzar en un folio usado, las posiciones anteriores ya impresas
-- ocupan parte de su capacidad. Se conservan como un dato del origen del libro.
CREATE OR REPLACE FUNCTION sacramentum_private.used_positions_in_first_folio_v330(
  p_table text, p_parish_id uuid, p_book_type text, p_book text, p_folio integer, p_number integer
) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $used$
DECLARE
  used_positions integer;
BEGIN
  IF p_table NOT IN ('baptisms','confirmations','marriages','funerals') THEN
    RAISE EXCEPTION 'Libro sacramental no disponible.' USING ERRCODE='22023';
  END IF;
  EXECUTE format($lookup$
    SELECT count(DISTINCT ltrim(btrim(r.number),'0'))::integer
    FROM public.%I r
    WHERE r.parish_id=$1
      AND (CASE WHEN btrim(r.book_number) ~ '^[0-9]+$'
        THEN ltrim(btrim(r.book_number),'0') ELSE lower(btrim(r.book_number)) END)=$2
      AND ltrim(btrim(r.folio),'0')=$3::text
      AND CASE WHEN btrim(r.number) ~ '^[0-9]{1,10}$' THEN btrim(r.number)::bigint BETWEEN 1 AND $4-1 ELSE false END
      %s
  $lookup$,p_table,CASE WHEN p_table IN ('marriages','funerals')
    THEN 'AND lower(coalesce(nullif(btrim(r.book_type),''''),''ordinario''))=$5' ELSE '' END)
  INTO used_positions USING p_parish_id,
    CASE WHEN btrim(p_book) ~ '^[0-9]+$' THEN ltrim(btrim(p_book),'0') ELSE lower(btrim(p_book)) END,
    p_folio,p_number,p_book_type;
  RETURN used_positions;
END;
$used$;

CREATE OR REPLACE FUNCTION sacramentum_private.advance_seat_v328(
  p_params jsonb, p_prefix text, p_folio integer, p_number integer,
  p_capacity integer, p_restart boolean
) RETURNS TABLE(next_folio integer, next_number integer)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $sequence$
  WITH origin AS (
    SELECT coalesce((p_params->>(p_prefix || 'FirstNumber'))::integer,1) AS first_number,
      coalesce((p_params->>(p_prefix || 'FirstFolioUsed'))::integer,0) AS first_folio_used
  ), seat AS (
    SELECT CASE
      WHEN p_restart THEN p_number >= p_capacity + CASE
        WHEN p_folio=(p_params->>(p_prefix || 'FirstFolio'))::integer
          THEN first_number-1-first_folio_used ELSE 0 END
      ELSE mod(p_number-first_number+first_folio_used+1,p_capacity)=0
      END AS end_of_folio
    FROM origin
  )
  SELECT p_folio+end_of_folio::integer,
    CASE WHEN p_restart AND end_of_folio THEN 1 ELSE p_number+1 END
  FROM seat;
$sequence$;

CREATE OR REPLACE FUNCTION sacramentum_private.next_unoccupied_seat_v328(
  p_table text, p_parish_id uuid, p_params jsonb, p_book_type text,
  p_book integer, p_folio integer, p_number integer, p_capacity integer, p_restart boolean
) RETURNS TABLE(available_folio integer, available_number integer, advanced boolean)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $available$
BEGIN
  available_folio:=p_folio;
  available_number:=p_number;
  advanced:=false;
  WHILE sacramentum_private.seat_position_occupied_v330(
    p_table,p_parish_id,p_book_type,p_book::text,available_folio,available_number
  ) LOOP
    SELECT s.next_folio,s.next_number INTO available_folio,available_number
    FROM sacramentum_private.advance_seat_v328(
      p_params,p_book_type,available_folio,available_number,p_capacity,p_restart
    ) s;
    IF available_folio>9999 OR available_number>9999 THEN
      RAISE EXCEPTION 'El consecutivo de este libro se agotó. Revise el libro físico antes de asentar.' USING ERRCODE='22003';
    END IF;
    advanced:=true;
  END LOOP;
  RETURN NEXT;
END;
$available$;

-- Los escritores V328 conservan las reglas sacramentales y las transacciones del lote.
DO $ordinary$
DECLARE
  item record;
  source text;
  old_anchor text;
  new_anchor text;
  old_advance text;
  new_advance text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('sacramentum_private.ordinary_seat_context_v328(uuid,text,uuid[],boolean)'),
    ('public.seat_parish_records_v328(uuid,text,jsonb,jsonb,jsonb)'),
    ('sacramentum_private.seat_baptism_records_v328(uuid,jsonb,integer,integer,integer)'),
    ('sacramentum_private.seat_confirmation_records_v328(uuid,jsonb,integer,integer,integer)'),
    ('sacramentum_private.seat_pending_marriage_v328(uuid)'),
    ('sacramentum_private.seat_funeral_record_v328(jsonb,uuid)')
  ) AS targets(signature) LOOP
    source:=replace(pg_get_functiondef(to_regprocedure(item.signature)),chr(13)||chr(10),chr(10));
    IF source IS NULL THEN RAISE EXCEPTION 'Falta la función %',item.signature; END IF;
    IF strpos(source,'next_unoccupied_seat_v328')>0 AND
       (item.signature LIKE '%seat_baptism%' OR item.signature LIKE '%seat_confirmation%'
        OR item.signature LIKE '%seat_pending_marriage%' OR item.signature LIKE '%seat_funeral%') THEN
      CONTINUE;
    END IF;
    IF strpos(source,'FirstFolioUsed')>0 AND item.signature LIKE '%seat_parish_records%' THEN CONTINUE; END IF;

    IF item.signature LIKE '%ordinary_seat_context%' THEN
      old_anchor:=$old$  EXECUTE format($used$
    SELECT EXISTS (
      SELECT 1 FROM public.%I r
      WHERE r.parish_id=$1 AND ltrim(r.book_number,'0')=$2::text
        AND coalesce(nullif(r.raw_data->>'book_type',''),nullif(to_jsonb(r)->>'book_type',''),'ordinario')=$3
    )$used$,registry_table) INTO book_has_entries USING p_parish_id,book,target_type;
  started:=book_has_entries OR parameters ? (target_type || 'FirstNumber') OR book<>1 OR folio<>1 OR entry_number<>1;
  -- A legacy import can occupy the persisted pointer ahead of a new seat.
  -- Read the book position without modifying its entries or saving a new pointer.
  SELECT s.available_folio, s.available_number, s.advanced INTO folio, entry_number, advanced
  FROM sacramentum_private.next_unoccupied_seat_v328(
    registry_table,p_parish_id,parameters,target_type,book,folio,entry_number,capacity,restart
  ) s;$old$;
      new_anchor:=$new$  -- Preserva memorias anteriores ya avanzadas y las iniciadas explícitamente.
  started:=parameters ? (target_type || 'FirstNumber') OR book<>1 OR folio<>1 OR entry_number<>1;
  advanced:=false;
  IF started THEN
    SELECT s.available_folio,s.available_number,s.advanced INTO folio,entry_number,advanced
    FROM sacramentum_private.next_unoccupied_seat_v328(
      registry_table,p_parish_id,parameters,target_type,book,folio,entry_number,capacity,restart
    ) s;
  END IF;$new$;
      source:=replace(source,E'  book_has_entries boolean;\n','');

    ELSIF item.signature LIKE '%seat_parish_records%' THEN
      old_anchor:=$old$    -- Iniciar sólo un libro vacío. Un libro señalado con otro número puede
    -- contener partidas históricas y tener una capacidad que deba preservarse.
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM public.%I r WHERE r.parish_id=$1 AND ltrim(r.book_number,''0'')=$2::text
       AND coalesce(nullif(r.raw_data->>''book_type'',''''),nullif(to_jsonb(r)->>''book_type'',''''),''ordinario'')=$3)',
      context->>'registryTable') INTO book_has_entries USING p_parish_id,book,target_type;
    IF book_has_entries THEN
      RAISE EXCEPTION 'El Libro indicado ya contiene partidas. Use un libro sin asientos para inicializar la numeración.' USING ERRCODE='23514';
    END IF;$old$;
      new_anchor:=$new$    IF sacramentum_private.seat_position_occupied_v330(
      context->>'registryTable',p_parish_id,target_type,book::text,folio,entry_number
    ) THEN
      RAISE EXCEPTION 'Esa posición ya está registrada. Confirme una ubicación libre del libro físico.'
        USING ERRCODE='23514';
    END IF;$new$;
      source:=replace(source,'  book_has_entries boolean;','  first_folio_used integer;');
      source:=replace(source,$old$    restart:=(p_coordinates->>'restart')::boolean;
    EXECUTE format$old$,$new$    restart:=(p_coordinates->>'restart')::boolean;
    first_folio_used:=sacramentum_private.used_positions_in_first_folio_v330(
      context->>'registryTable',p_parish_id,target_type,book::text,folio,entry_number
    );
    IF p_coordinates ? 'firstFolioUsed' THEN
      IF NOT coalesce(p_coordinates->>'firstFolioUsed' ~ '^[0-9]{1,4}$',false)
        OR (p_coordinates->>'firstFolioUsed')::integer<first_folio_used THEN
        RAISE EXCEPTION 'Confirme cuántas partidas físicas anteceden a esta en el folio indicado.'
          USING ERRCODE='23514';
      END IF;
      first_folio_used:=(p_coordinates->>'firstFolioUsed')::integer;
    END IF;
    IF first_folio_used>=capacity THEN
      RAISE EXCEPTION 'El folio indicado ya alcanzó su capacidad. Confirme la ubicación del folio siguiente.'
        USING ERRCODE='23514';
    END IF;
    EXECUTE format$new$);
      source:=replace(source,$old$target_type || 'FirstFolio',folio,target_type || 'FirstNumber',entry_number,$old$,
        $new$target_type || 'FirstFolio',folio,target_type || 'FirstNumber',entry_number,
      target_type || 'FirstFolioUsed',first_folio_used,$new$);

    ELSIF item.signature LIKE '%seat_baptism%' OR item.signature LIKE '%seat_confirmation%' THEN
      old_anchor:=$old$    SELECT s.next_folio, s.next_number INTO v_folio, v_number
    FROM sacramentum_private.advance_seat_v328(v_params,'ordinario',v_folio,v_number,v_limit,v_restart) s;$old$;
      new_anchor:=old_anchor || format($seek$
    SELECT s.available_folio,s.available_number INTO v_folio,v_number
    FROM sacramentum_private.next_unoccupied_seat_v328(
      %L,p_parish_id,v_params,'ordinario',v_book,v_folio,v_number,v_limit,v_restart
    ) s;$seek$,CASE WHEN item.signature LIKE '%seat_baptism%' THEN 'baptisms' ELSE 'confirmations' END);

      IF item.signature LIKE '%seat_confirmation%' AND strpos(source,'cross_note_template')=0 THEN
        old_advance:=$old$    v_cross_note:=nullif(trim(coalesce(v_rec->>'cross_note','')),'');$old$;
        new_advance:=$new$    v_cross_note:=nullif(btrim(v_rec->>'cross_note'),'');
    IF v_rec ? 'cross_note_template' THEN
      v_cross_note:=nullif(btrim(replace(replace(replace(v_rec->>'cross_note_template',
        '[LIBRO_CONF]',lpad(v_book::text,4,'0')),
        '[FOLIO_CONF]',lpad(v_folio::text,4,'0')),
        '[NUMERO_CONF]',lpad(v_number::text,4,'0'))),'');
    ELSIF note_positions_changed AND v_cross_note IS NOT NULL THEN
      RAISE EXCEPTION 'La posición de la nota marginal cambió. Recargue la pantalla para continuar.'
        USING ERRCODE='40001';
    END IF;$new$;
        IF strpos(source,old_advance)=0 THEN
          RAISE EXCEPTION 'Falta la escritura de la nota marginal de Confirmación';
        END IF;
        source:=replace(source,old_advance,new_advance);
        source:=replace(source,'  v_role text;',E'  v_role text;\n  occupied_skipped boolean;\n  note_positions_changed boolean:=false;');
        new_anchor:=replace(new_anchor,'s.available_folio,s.available_number INTO v_folio,v_number',
          's.available_folio,s.available_number,s.advanced INTO v_folio,v_number,occupied_skipped') ||
          E'\n    note_positions_changed:=note_positions_changed OR occupied_skipped;';
      END IF;

    ELSE
      old_anchor:=$old$  SELECT s.next_folio, s.next_number INTO v_next_folio, v_next_number
  FROM sacramentum_private.advance_seat_v328(v_params,v_book_type,v_folio,v_number,v_limit,v_restart) s;$old$;
      new_anchor:=old_anchor || format($seek$
  SELECT s.available_folio,s.available_number INTO v_next_folio,v_next_number
  FROM sacramentum_private.next_unoccupied_seat_v328(
    %L,v_parish,v_params,v_book_type,v_book,v_next_folio,v_next_number,v_limit,v_restart
  ) s;$seek$,CASE WHEN item.signature LIKE '%seat_pending_marriage%' THEN 'marriages' ELSE 'funerals' END);
    END IF;

    IF strpos(source,new_anchor)>0 THEN CONTINUE; END IF;
    IF strpos(source,old_anchor)=0 OR
      strpos(substr(source,strpos(source,old_anchor)+length(old_anchor)),old_anchor)>0 THEN
      RAISE EXCEPTION 'Revisar la definición de % antes de migrar',item.signature;
    END IF;
    EXECUTE replace(source,old_anchor,new_anchor);
  END LOOP;
END;
$ordinary$;

-- Las digitalizaciones comparten el candado de la parroquia durante el alta,
-- sin cambiar la fila de memoria ni tomar el siguiente número.
DO $historical$
DECLARE
  item record;
  source text;
  anchor text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.register_historical_marriage(uuid,jsonb)','  v_book:=public.sacramentum_registry_ref('),
    ('public.register_historical_funeral(uuid,jsonb)','  v_book := public.sacramentum_registry_ref('),
    ('public.register_historical_narrative(uuid,text,jsonb)','  v_book := public.sacramentum_registry_ref(')
  ) AS targets(signature,marker) LOOP
    source:=replace(pg_get_functiondef(to_regprocedure(item.signature)),chr(13)||chr(10),chr(10));
    IF source IS NULL OR strpos(source,item.marker)=0 THEN RAISE EXCEPTION 'Revisar % antes de migrar',item.signature; END IF;
    anchor:=$lock$  PERFORM 1 FROM public.parish_parameters pp WHERE pp.parish_id=p_parish_id FOR UPDATE;
$lock$;
    IF strpos(source,anchor)=0 THEN
      EXECUTE replace(source,item.marker,anchor||item.marker);
    END IF;
  END LOOP;
END;
$historical$;


REVOKE ALL ON FUNCTION sacramentum_private.used_positions_in_first_folio_v330(text,uuid,text,text,integer,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION sacramentum_private.seat_position_occupied_v330(text,uuid,text,text,integer,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION sacramentum_private.next_unoccupied_seat_v328(text,uuid,jsonb,text,integer,integer,integer,integer,boolean)
  FROM PUBLIC,anon,authenticated;
