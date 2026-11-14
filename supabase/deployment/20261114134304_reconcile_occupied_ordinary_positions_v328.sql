-- Reconciliación del cursor con posiciones ya ocupadas por el libro parroquial.
CREATE OR REPLACE FUNCTION sacramentum_private.next_unoccupied_seat_v328(
  p_table text, p_parish_id uuid, p_params jsonb, p_book_type text,
  p_book integer, p_folio integer, p_number integer, p_capacity integer, p_restart boolean
) RETURNS TABLE(available_folio integer, available_number integer, advanced boolean)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $available$
DECLARE
  occupied_positions jsonb;
  slot_exists boolean;
  cursor_key text;
BEGIN
  available_folio:=p_folio;
  available_number:=p_number;
  advanced:=false;

  EXECUTE format($slot$
    SELECT EXISTS(
      SELECT 1 FROM public.%I r
      WHERE r.parish_id=$1 AND ltrim(r.book_number,'0')=$2::text AND ltrim(r.folio,'0')=$3::text
        AND ltrim(r.number,'0')=$4::text AND coalesce(nullif(to_jsonb(r)->>'book_type',''),r.raw_data->>'book_type','ordinario')=$5
    )$slot$,p_table) INTO slot_exists USING p_parish_id,p_book,p_folio,p_number,p_book_type;
  IF NOT slot_exists THEN
    RETURN NEXT;
    RETURN;
  END IF;

  EXECUTE format($slots$
    SELECT coalesce(jsonb_object_agg(ltrim(r.folio,'0') || ':' || ltrim(r.number,'0'),true),'{}'::jsonb)
    FROM public.%I r
    WHERE r.parish_id=$1 AND ltrim(r.book_number,'0')=$2::text
      AND coalesce(nullif(to_jsonb(r)->>'book_type',''),r.raw_data->>'book_type','ordinario')=$3
      AND r.folio ~ '^[0-9]+$' AND r.number ~ '^[0-9]+$'
    $slots$,p_table) INTO occupied_positions USING p_parish_id,p_book,p_book_type;

  advanced:=true;
  LOOP
    SELECT seq.next_folio,seq.next_number INTO available_folio,available_number
    FROM sacramentum_private.advance_seat_v328(p_params,p_book_type,available_folio,available_number,p_capacity,p_restart) seq;
    IF available_folio>9999 OR available_number>9999 THEN
      RAISE EXCEPTION 'El consecutivo de este libro se agotó. Revise el libro físico antes de asentar.' USING ERRCODE='22003';
    END IF;
    cursor_key:=format('%s:%s',available_folio,available_number);
    EXIT WHEN NOT (occupied_positions ? cursor_key);
  END LOOP;
  RETURN NEXT;
END;
$available$;

REVOKE ALL ON FUNCTION sacramentum_private.next_unoccupied_seat_v328(
  text,uuid,jsonb,text,integer,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated;

DO $patch$
DECLARE
  item record;
  definition text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    (1, 'sacramentum_private.ordinary_seat_context_v328(uuid,text,uuid[],boolean)',
      '  found_rows integer:=0;', E'  found_rows integer:=0;\n  advanced boolean;'),
    (2, 'sacramentum_private.ordinary_seat_context_v328(uuid,text,uuid[],boolean)',
      $before$  started:=book_has_entries OR parameters ? (target_type || 'FirstNumber') OR book<>1 OR folio<>1 OR entry_number<>1;
  RETURN jsonb_build_object('bookType',target_type,'book',book,'folio',folio,'number',entry_number,
    'capacity',capacity,'restart',restart,'initial',NOT started,$before$,
      $after$  started:=book_has_entries OR parameters ? (target_type || 'FirstNumber') OR book<>1 OR folio<>1 OR entry_number<>1;
  -- A legacy import can occupy the persisted pointer ahead of a new seat.
  -- Read the book position without modifying its entries or saving a new pointer.
  SELECT s.available_folio, s.available_number, s.advanced INTO folio, entry_number, advanced
  FROM sacramentum_private.next_unoccupied_seat_v328(
    registry_table,p_parish_id,parameters,target_type,book,folio,entry_number,capacity,restart
  ) s;
  RETURN jsonb_build_object('bookType',target_type,'book',book,'folio',folio,'number',entry_number,
    'capacity',capacity,'restart',restart,'initial',NOT started,'advanced',advanced,$after$),
    (3, 'public.seat_parish_records_v328(uuid,text,jsonb,jsonb,jsonb)',
      $before$    RAISE EXCEPTION 'Libro, Folio y Número deben coincidir con el siguiente asiento del libro.' USING ERRCODE='23514';
  END IF;

  CASE p_sacrament$before$,
      $after$    RAISE EXCEPTION 'Libro, Folio y Número deben coincidir con el siguiente asiento del libro.' USING ERRCODE='23514';
  ELSIF (context->>'advanced')::boolean THEN
    EXECUTE format('UPDATE public.parish_parameters SET %1$I=coalesce(%1$I,''{}''::jsonb) || $1
      WHERE parish_id=$2', parameter_column)
    USING jsonb_build_object(target_type || 'Folio',folio,target_type || 'Numero',entry_number),p_parish_id;
  END IF;

  CASE p_sacrament$after$)
  ) changes(step,signature,before_text,after_text) ORDER BY step
  LOOP
    definition:=replace(pg_get_functiondef(to_regprocedure(item.signature)),chr(13)||chr(10),chr(10));
    IF strpos(definition,item.after_text)>0 THEN CONTINUE; END IF;
    IF definition IS NULL OR strpos(definition,item.before_text)=0 OR
       strpos(substr(definition,strpos(definition,item.before_text)+length(item.before_text)),item.before_text)>0 THEN
      RAISE EXCEPTION 'Revisar definición de % antes de migrar',item.signature;
    END IF;
    EXECUTE replace(definition,item.before_text,item.after_text);
  END LOOP;
END;
$patch$;
