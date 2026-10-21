-- SACRAMENTUM V99 · Corregir origen histórico al reimportar conceptos.
--
-- Descubrimiento: apply_legacy_import_batch insertaba conceptos_anulacion
-- sin source_kind ni source_reference, generando erroneamente 'manual'.
--
-- Se modifica SOLO ese bloque dentro de la función original de 22k caracteres.
-- Preservamos firma, OWNER, SECURITY DEFINER, búsquedas, validaciones,
-- transacciones y todos los demás perfiles de importación.
-- Fallar deliberadamente si el código no es exactamente el esperado.
DO $migration$
DECLARE
 v_original text;
 v_new text;
 v_start integer;
 v_end integer;
 v_section text;
 v_header text :=
  'insert into public.conceptos_anulacion(diocese_id,seinscribe,gennota,gendocum,enlibro,expide,tipo,concepto,codigo)';
 v_header_new text :=
  'insert into public.conceptos_anulacion(diocese_id,seinscribe,gennota,gendocum,enlibro,expide,tipo,concepto,codigo,source_kind,source_reference)';
 v_tail text := 'coalesce(nullif(d->>''code'',''''),r.source_key))';
 v_tail_new text :=
  'coalesce(nullif(d->>''code'',''''),r.source_key),''legacy_catalog'',''legacy_batch:''||v_batch.id::text||''/row:''||r.id::text)';
BEGIN
 SELECT pg_get_functiondef('public.apply_legacy_import_batch(uuid,integer)'::regprocedure) INTO v_original;
 v_start := strpos(v_original, 'elsif r.target_entity=''annulment_concept'' then');
 v_end := strpos(v_original, 'elsif r.target_entity=''decree_link'' then');
 IF v_start=0 OR v_end<=v_start THEN
   RAISE EXCEPTION 'Importador heredado no coincide con versión auditada; sin cambios';
 END IF;
 v_section := substring(v_original FROM v_start FOR v_end-v_start);
 IF strpos(v_section,v_header)=0 OR strpos(v_section,v_tail)=0
    OR strpos(v_section,'source_kind')>0 THEN
   RAISE EXCEPTION 'Bloque de conceptos no coincide con versión auditada; sin cambios';
 END IF;
 v_section := replace(replace(v_section,v_header,v_header_new),v_tail,v_tail_new);
 v_new := substring(v_original FROM 1 FOR v_start-1)
       || v_section || substring(v_original FROM v_end);
 EXECUTE v_new;
END$migration$;