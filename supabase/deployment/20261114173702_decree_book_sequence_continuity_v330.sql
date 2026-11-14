ALTER TABLE sacramentum_ledger.book_memories
  ADD COLUMN IF NOT EXISTS first_folio_used integer NOT NULL DEFAULT 0
  CHECK (first_folio_used>=0 AND first_folio_used<partidas_per_folio);

-- Amplía la apertura del libro con el número de partidas físicas del primer folio.
-- La firma original se conserva para clientes abiertos antes de la actualización.
DO $signature$
DECLARE source text:=pg_get_functiondef('public.seat_chancery_decree_v280(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid)'::regprocedure);
BEGIN
  IF to_regprocedure('public.seat_chancery_decree_v330(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid,integer)') IS NULL THEN
    source:=replace(source,'public.seat_chancery_decree_v280(','public.seat_chancery_decree_v330(');
    source:=replace(source,'p_operation_id uuid)','p_operation_id uuid, p_first_folio_used integer DEFAULT NULL)');
    EXECUTE source;
  END IF;
END;
$signature$;

-- Calcula la próxima posición sobre el libro físico. El ordinal sigue contando
-- sólo los asientos nuevos de la memoria y nunca se asigna a una digitalización.
CREATE OR REPLACE FUNCTION sacramentum_private.next_supplementary_seat_v330(
  p_book sacramentum_ledger.book_memories
) RETURNS TABLE(folio integer, number integer, advanced boolean)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $position$
DECLARE
  physical_table text;
  prior record;
  sequence_origin jsonb;
BEGIN
  IF p_book.book_type<>'suplementario' OR p_book.closed_at IS NOT NULL
     OR p_book.retired_at IS NOT NULL OR p_book.legacy_reconciled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'La posición solicitada requiere un libro supletorio abierto.' USING ERRCODE='22023';
  END IF;
  physical_table:=CASE p_book.sacrament WHEN 'bautismo' THEN 'baptisms'
    WHEN 'confirmacion' THEN 'confirmations' WHEN 'matrimonio' THEN 'marriages' WHEN 'exequias' THEN 'funerals' END;

  sequence_origin:=jsonb_build_object('suplementarioFirstFolio',p_book.first_folio,'suplementarioFirstNumber',p_book.first_partida,
    'suplementarioFirstFolioUsed',p_book.first_folio_used);
  IF p_book.active_count=0 THEN
    folio:=p_book.first_folio;
    number:=p_book.first_partida;
  ELSE
    SELECT s.folio,s.partida INTO STRICT prior FROM sacramentum_ledger.active_seats s
    WHERE s.book_id=p_book.id AND s.ordinal=p_book.active_count-1;
    SELECT s.next_folio,s.next_number INTO folio,number FROM sacramentum_private.advance_seat_v328(
      sequence_origin,'suplementario',prior.folio,prior.partida,p_book.partidas_per_folio,p_book.restart_partida_each_folio
    ) s;
  END IF;

  advanced:=false;
  WHILE sacramentum_private.seat_position_occupied_v330(
    physical_table,p_book.parish_id,'suplementario',p_book.book_code,folio,number
  ) LOOP
    SELECT s.next_folio,s.next_number INTO folio,number FROM sacramentum_private.advance_seat_v328(
      sequence_origin,'suplementario',folio,number,p_book.partidas_per_folio,p_book.restart_partida_each_folio
    ) s;
    advanced:=true;
    IF folio>9999 OR number>9999 THEN EXIT; END IF;
  END LOOP;
  IF folio NOT BETWEEN 1 AND 9999 OR number NOT BETWEEN 1 AND 9999 THEN
    RAISE EXCEPTION 'El consecutivo de este libro supletorio se agotó. Revise el libro físico.' USING ERRCODE='22003';
  END IF;
  RETURN NEXT;
END;
$position$;

REVOKE ALL ON FUNCTION sacramentum_private.next_supplementary_seat_v330(sacramentum_ledger.book_memories)
  FROM PUBLIC,anon,authenticated;

DO $decrees$
DECLARE
  item record;
  source text;
  old_anchor text;
  new_anchor text;
  old_math text;
  new_math text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.get_parish_decree_books_v280(uuid)'),
    ('public.seat_chancery_decree_v330(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid,integer)'),
    ('sacramentum_ledger.real_seat_v263(uuid,text,uuid,bigint,integer,integer,uuid,jsonb)'),
    ('sacramentum_ledger.append_verified_batch_v281(uuid,bigint,uuid,integer,integer,jsonb,uuid)')
  ) AS targets(signature) LOOP
    source:=replace(pg_get_functiondef(to_regprocedure(item.signature)),chr(13)||chr(10),chr(10));
    IF source IS NULL THEN RAISE EXCEPTION 'Falta la función %',item.signature; END IF;
    IF strpos(source,'next_supplementary_seat_v330')>0 OR strpos(source,'seat_position_occupied_v330')>0 THEN
      CONTINUE;
    END IF;

    IF item.signature LIKE '%get_parish_decree_books%' THEN
      old_anchor:=$old$  'nextFolio',m.first_folio+m.active_count/m.partidas_per_folio,
  'nextNumber',CASE WHEN m.restart_partida_each_folio
    AND m.active_count>=m.partidas_per_folio
    THEN 1+m.active_count%m.partidas_per_folio
    ELSE m.first_partida+m.active_count END,$old$;
      new_anchor:=$new$  'nextFolio',position.folio,'nextNumber',position.number,'advanced',position.advanced,$new$;
      source:=replace(source,$old$ FROM sacramentum_ledger.book_memories m
 WHERE m.parish_id=p AND m.sacrament=decree.sacrament_type
 AND m.book_type='suplementario' AND m.legacy_reconciled
 AND m.closed_at IS NULL AND m.retired_at IS NULL;$old$,$new$ FROM (
   SELECT b AS book
   FROM sacramentum_ledger.book_memories b
   WHERE b.parish_id=p AND b.sacrament=decree.sacrament_type
     AND b.book_type='suplementario' AND b.legacy_reconciled
     AND b.closed_at IS NULL AND b.retired_at IS NULL
   OFFSET 0
 ) scoped
 CROSS JOIN LATERAL sacramentum_private.next_supplementary_seat_v330(scoped.book) position;$new$);
      IF strpos(source,'next_supplementary_seat_v330(scoped.book)')=0 THEN
        RAISE EXCEPTION 'No se encontró la consulta de libros supletorios de la parroquia';
      END IF;

    ELSIF item.signature LIKE '%seat_chancery_decree%' THEN
      old_anchor:=$old$   EXECUTE format('SELECT count(*) FROM public.%I
     WHERE parish_id=$1 AND
     (CASE WHEN book_number ~ ''^[0-9]+$''
      THEN coalesce(nullif(ltrim(book_number,''0''),''''),''0'')
      ELSE upper(book_number) END)=$2',t)
    INTO num USING p,canon;
   IF num<>0 THEN RAISE EXCEPTION 'V280: este libro ya contiene partidas físicas no conciliadas'; END IF;$old$;
      new_anchor:=$new$   IF sacramentum_private.seat_position_occupied_v330(t,p,'suplementario',code,p_folio,p_number) THEN
     RAISE EXCEPTION 'Esa posición ya está registrada. Confirme una ubicación libre del libro físico.'
       USING ERRCODE='23514';
   END IF;
   first_folio_used:=sacramentum_private.used_positions_in_first_folio_v330(t,p,'suplementario',code,p_folio,p_number);
   IF p_first_folio_used IS NOT NULL THEN
     IF p_first_folio_used<first_folio_used THEN
       RAISE EXCEPTION 'Confirme cuántas partidas anteceden a esta en el folio físico.' USING ERRCODE='23514';
     END IF;
     first_folio_used:=p_first_folio_used;
   END IF;
   IF first_folio_used>=p_partidas_per_folio THEN
     RAISE EXCEPTION 'El folio indicado ya alcanzó su capacidad. Confirme la ubicación del folio siguiente.'
       USING ERRCODE='23514';
   END IF;$new$;
      source:=replace(source,' num int; capacity int; v_affected int;',' first_folio_used integer; v_affected int;');
      source:=replace(source,'p_folio IS NULL OR p_folio<1 OR p_number IS NULL OR p_number<1',
        'p_folio IS NULL OR p_folio NOT BETWEEN 1 AND 9999 OR p_number IS NULL OR p_number NOT BETWEEN 1 AND 9999');
      source:=replace(source,$old$partidas_per_folio,restart_partida_each_folio,legacy_reconciled)
   VALUES(p,d.sacrament_type,'suplementario',code,p_folio,p_number,
    p_partidas_per_folio,p_restart_number_each_folio,true)$old$,
        $new$partidas_per_folio,restart_partida_each_folio,first_folio_used,legacy_reconciled)
   VALUES(p,d.sacrament_type,'suplementario',code,p_folio,p_number,
    p_partidas_per_folio,p_restart_number_each_folio,first_folio_used,true)$new$);
      IF strpos(source,'p_restart_number_each_folio,first_folio_used,true')=0 THEN
        RAISE EXCEPTION 'No se encontró el alta de la memoria supletoria';
      END IF;

    ELSIF item.signature LIKE '%real_seat_v263%' THEN
      old_anchor:=$old$   OR m.first_folio+m.active_count/m.partidas_per_folio<>p_expected_folio
   OR (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
       THEN 1+m.active_count%m.partidas_per_folio
       ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
   RAISE EXCEPTION 'V263: libro no conciliado, ajeno o posición ya cambiada';
 END IF;$old$;
      new_anchor:=$new$   OR (m.book_type<>'suplementario' AND (
        (m.first_folio+m.active_count/m.partidas_per_folio,
         CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
           THEN 1+m.active_count%m.partidas_per_folio
           ELSE m.first_partida+m.active_count END) IS DISTINCT FROM (p_expected_folio,p_expected_partida)
      )) THEN
   RAISE EXCEPTION 'V263: libro no conciliado, ajeno o posición ya cambiada';
 END IF;
 IF m.book_type='suplementario' AND NOT EXISTS (
   SELECT 1 FROM sacramentum_private.next_supplementary_seat_v330(m) s
   WHERE (s.folio,s.number)=(p_expected_folio,p_expected_partida)
 ) THEN
   RAISE EXCEPTION 'V263: confirme la siguiente posición libre del libro supletorio';
 END IF;$new$;

    ELSE
      old_anchor:=$old$ IF (m.first_folio::bigint+m.active_count::bigint/m.partidas_per_folio::bigint)<>p_expected_folio
  OR (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
      THEN 1+m.active_count%m.partidas_per_folio
      ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
  RAISE EXCEPTION 'Libro %, folio o partida inicial no coincide con la memoria',m.book_code;
 END IF;$old$;
      new_anchor:=$new$ IF m.book_type='suplementario' THEN
   IF jsonb_array_length(p_items)<>1 THEN
     RAISE EXCEPTION 'Confirme cada decreto por separado y en el orden de la cola.';
   END IF;
   SELECT s.folio,s.number INTO STRICT f,n FROM sacramentum_private.next_supplementary_seat_v330(m) s;
   IF (f,n) IS DISTINCT FROM (p_expected_folio,p_expected_partida) THEN
     RAISE EXCEPTION 'La posición solicitada no coincide con la siguiente libre del libro %',m.book_code;
   END IF;
 ELSIF (m.first_folio::bigint+m.active_count::bigint/m.partidas_per_folio::bigint)<>p_expected_folio
  OR (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
      THEN 1+m.active_count%m.partidas_per_folio
      ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
  RAISE EXCEPTION 'Libro %, folio o partida inicial no coincide con la memoria',m.book_code;
 END IF;$new$;
      old_math:=$old$  f:=m.first_folio+cnt/m.partidas_per_folio;
  n:=CASE WHEN m.restart_partida_each_folio AND cnt>=m.partidas_per_folio
     THEN 1+cnt%m.partidas_per_folio ELSE m.first_partida+cnt END;$old$;
      new_math:=$new$  IF m.book_type<>'suplementario' THEN
    f:=m.first_folio+cnt/m.partidas_per_folio;
    n:=CASE WHEN m.restart_partida_each_folio AND cnt>=m.partidas_per_folio
       THEN 1+cnt%m.partidas_per_folio ELSE m.first_partida+cnt END;
  END IF;$new$;
      IF strpos(source,old_math)=0 THEN
        RAISE EXCEPTION 'No se encontró el punto de asignación del motor';
      END IF;
      source:=replace(source,old_math,new_math);
    END IF;

    IF strpos(source,old_anchor)=0 OR
      strpos(substr(source,strpos(source,old_anchor)+length(old_anchor)),old_anchor)>0 THEN
      RAISE EXCEPTION 'Revisar la definición de % antes de migrar',item.signature;
    END IF;
    source:=replace(source,old_anchor,new_anchor);
    IF item.signature LIKE '%get_parish_decree_books%' THEN
      source:=replace(source,'m.','(scoped.book).');
    END IF;
    EXECUTE source;
  END LOOP;
END;
$decrees$;


-- El dato de apertura queda fijado junto con la capacidad y el modo de numeración.
DO $configuration$
DECLARE source text:=pg_get_functiondef('sacramentum_ledger.protect_seated_book_configuration()'::regprocedure);
BEGIN
  IF strpos(source,'NEW.first_folio_used')=0 THEN
    IF strpos(source,'OR NEW.first_folio IS DISTINCT FROM OLD.first_folio')=0 THEN
      RAISE EXCEPTION 'No se encontró la comprobación inmutable de la configuración del libro';
    END IF;
    EXECUTE replace(source,'OR NEW.first_folio IS DISTINCT FROM OLD.first_folio',
      E'OR NEW.first_folio IS DISTINCT FROM OLD.first_folio\n    OR NEW.first_folio_used IS DISTINCT FROM OLD.first_folio_used');
  END IF;
END;
$configuration$;

REVOKE ALL ON FUNCTION public.seat_chancery_decree_v330(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seat_chancery_decree_v330(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid,integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.seat_chancery_decree_v280(
  p_decree_id uuid,p_book_code text,p_book_id uuid,p_folio integer,p_number integer,p_partidas_per_folio integer,
  p_restart_number_each_folio boolean,p_expected_version bigint,p_operation_id uuid
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $compat$
  SELECT public.seat_chancery_decree_v330(p_decree_id,p_book_code,p_book_id,p_folio,p_number,p_partidas_per_folio,
    p_restart_number_each_folio,p_expected_version,p_operation_id,NULL);
$compat$;
REVOKE ALL ON FUNCTION public.seat_chancery_decree_v280(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seat_chancery_decree_v280(uuid,text,uuid,integer,integer,integer,boolean,bigint,uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
