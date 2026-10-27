-- SACRAMENTUM V244 — authorize owner/jurisdiction before reading legacy batch metadata.
-- QA schema-only fix; prevents BOLA information disclosure for ANULACION imports.
-- Every replacement requires exact match, otherwise entire migration fails closed.
DO $v244$
DECLARE
 v_sig text;
 v_src text;
 v_old text;
 v_new text;
 v_hits int;
BEGIN
 FOREACH v_sig IN ARRAY ARRAY[
   'public.apply_legacy_import_batch_v2(uuid,integer)',
   'public.apply_legacy_import_batch_v3(uuid,integer)'
 ] LOOP
   SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_src;
   IF v_src IS NULL THEN RAISE EXCEPTION 'V244 missing expected legacy RPC %',v_sig; END IF;

   IF v_sig LIKE '%_v2(%' THEN
     v_old := 'select * into v_batch from public.legacy_import_batches where id=p_batch_id for update;';
     v_new := 'select * into v_batch from public.legacy_import_batches where id=p_batch_id and public.can_manage_legacy_import(parish_id,diocese_id) for update;';
   ELSE
     v_old := '  where id=p_batch_id;';
     v_new := '  where id=p_batch_id and public.can_manage_legacy_import(parish_id,diocese_id);';
   END IF;

   v_hits := (length(v_src)-length(replace(v_src,v_old,'')))/length(v_old);
   IF v_hits <> 1 THEN
     RAISE EXCEPTION 'V244 audited lookup drift: %, expected one, found %',v_sig,v_hits;
   END IF;
   v_src := replace(v_src,v_old,v_new);
   EXECUTE v_src;
 END LOOP;
END $v244$;

-- A batch from another parish/diocese is now indistinguishable from an absent batch
-- before type-specific ANULACION handling. Authorized behavior remains unchanged.
