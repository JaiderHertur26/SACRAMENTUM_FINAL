-- SACRAMENTUM V115: desambiguación de ON CONFLICT en notificación de reposición
-- Preserva la lógica y permisos de las RPC existentes; no cambia datos ni partidas.
DO $migrate$
DECLARE
  v_proc text;
  v_oid oid;
  v_source text;
  v_old text := 'on conflict (decree_id,receiver_parish_id,category) where decree_id is not null do nothing';
  v_new text := 'on conflict do nothing';
  v_hits integer;
  v_done integer := 0;
BEGIN
  FOREACH v_proc IN ARRAY ARRAY[
    'public.apply_baptism_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)',
    'public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)'
  ] LOOP
    v_oid:=to_regprocedure(v_proc)::oid;
    IF v_oid IS NULL THEN RAISE EXCEPTION 'V115: falta firma requerida: %',v_proc; END IF;
    SELECT pg_get_functiondef(v_oid) INTO STRICT v_source;
    v_hits:=(length(lower(v_source))-length(replace(lower(v_source),v_old,'')))/length(v_old);
    IF v_hits<>1 THEN
      RAISE EXCEPTION 'V115: la definición de % no coincide con contrato: %',v_proc,v_hits;
    END IF;
    v_source:=replace(v_source,v_old,v_new);
    IF position(v_old in lower(v_source))>0 THEN
      RAISE EXCEPTION 'V115: reemplazo incompleto de %',v_proc;
    END IF;
    EXECUTE v_source;
    v_done:=v_done+1;
  END LOOP;
  IF v_done<>2 THEN RAISE EXCEPTION 'V115: migración incompleta'; END IF;
END
$migrate$;