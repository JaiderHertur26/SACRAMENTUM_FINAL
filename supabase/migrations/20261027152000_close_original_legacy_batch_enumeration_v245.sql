-- SACRAMENTUM FINAL V245 -- close the two remaining legacy import batch enumeration paths.
-- Schema-only; no sacramental data writes and no permission expansion.
-- Security-definer owners, signatures, privileges and subsequent ANULACION denial retained.
DO $v245$
DECLARE
  v_signature text;
  v_ddl text;
  v_old text;
  v_new text;
  v_hits integer;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.apply_legacy_import_batch(uuid,integer)',
    'public.reconcile_legacy_anulacion_batch(uuid,integer)'
  ] LOOP
    SELECT pg_get_functiondef(to_regprocedure(v_signature)) INTO v_ddl;
    IF v_ddl IS NULL THEN RAISE EXCEPTION 'V245 expected function missing: %',v_signature; END IF;

    IF v_signature LIKE '%reconcile_legacy_anulacion_batch%' THEN
      v_old := 'where id = p_batch_id' || chr(10) || '  for update;';
      v_new := 'where id = p_batch_id' || chr(10)
        || '    and public.can_manage_legacy_import(parish_id,diocese_id)' || chr(10)
        || '  for update;';
    ELSE
      v_old := 'select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;';
      v_new := 'select * into v_batch from public.legacy_import_batches where id=p_batch_id and public.can_manage_legacy_import(parish_id,diocese_id) for update;';
    END IF;

    v_hits := (length(v_ddl)-length(replace(v_ddl,v_old,'')))/length(v_old);
    IF v_hits <> 1 THEN
      RAISE EXCEPTION 'V245 audited initial batch lookup drift: %, expected 1 but found %',v_signature,v_hits;
    END IF;

    v_ddl := replace(v_ddl,v_old,v_new);
    EXECUTE v_ddl;
  END LOOP;
END $v245$;

-- Foreign batch and missing batch now both yield Lote no encontrado; authorized
-- ANULACION batch remains denied by the documented Chancery-only processing path.
