-- V116. Desambiguar búsqueda de folio de Confirmación en reposición.
DO $m$
DECLARE
 v_fn text := 'public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)';
 v_source text;
 v_old text := 'exists(select 1 from public.confirmations where parish_id=p_parish_id and book_number=lpad(v_book::text,4,''0'') and folio=lpad(v_folio::text,4,''0'') and number=lpad(v_number::text,4,''0''))';
 v_new text := 'exists(select 1 from public.confirmations c where c.parish_id=p_parish_id and c.book_number=lpad(v_book::text,4,''0'') and c.folio=lpad(v_folio::text,4,''0'') and c.number=lpad(v_number::text,4,''0''))';
 v_hits integer;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure(v_fn)) INTO STRICT v_source;
 v_hits:=(length(lower(v_source))-length(replace(lower(v_source),lower(v_old),'')))/length(v_old);
 IF v_hits<>1 THEN RAISE EXCEPTION 'V116: contrato inesperado: % apariciones',v_hits; END IF;
 v_source:=replace(v_source,v_old,v_new);
 IF position(v_old in lower(v_source))>0 THEN RAISE EXCEPTION 'V116: reemplazo no realizado'; END IF;
 EXECUTE v_source;
END
$m$;