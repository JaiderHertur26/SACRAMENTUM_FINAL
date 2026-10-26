-- V213 · Fail-closed parish ownership for global legacy link keys.
-- A historical source_key can repeat in more than one parish. Never reuse a
-- linked sacrament/boleta from another parish or overwrite its provenance.
-- Replace only the lookup block of the existing private materializer. Every
-- remaining business rule and grants remain unchanged.
DO $migration$
DECLARE
 v_ddl text;
 v_old text := $needle$    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system = v_batch.source_system
      and l.profile_key = v_batch.profile_key
      and l.source_key = v_source_key
    limit 1;$needle$;
 v_new text := $replacement$    -- Serialize equal legacy keys before lookup or insert, including two
    -- concurrent requests for the same file from different dioceses/parishes.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_batch.source_system || ':' || v_batch.profile_key || ':' || v_source_key, 0
      )
    );
    -- Never return a foreign record ID as if it belonged to this batch.
    if exists (
      select 1
      from public.legacy_record_links l
      left join public.legacy_import_batches prior on prior.id = l.batch_id
      where l.source_system = v_batch.source_system
        and l.profile_key = v_batch.profile_key
        and l.source_key = v_source_key
        and (
          prior.parish_id is distinct from v_batch.parish_id
          or l.target_table not in (
            'pending_baptisms', 'pending_confirmations', 'baptisms', 'confirmations'
          )
          or (l.target_table = 'pending_baptisms' and not exists (
            select 1 from public.pending_baptisms x where x.id=l.target_id
              and x.parish_id=v_batch.parish_id))
          or (l.target_table = 'pending_confirmations' and not exists (
            select 1 from public.pending_confirmations x where x.id=l.target_id
              and x.parish_id=v_batch.parish_id))
          or (l.target_table = 'baptisms' and not exists (
            select 1 from public.baptisms x where x.id=l.target_id
              and x.parish_id=v_batch.parish_id))
          or (l.target_table = 'confirmations' and not exists (
            select 1 from public.confirmations x where x.id=l.target_id
              and x.parish_id=v_batch.parish_id))
        )
    ) then
      raise exception 'Clave histórica vinculada a otra parroquia o expediente. No se alteró el vínculo; revise la procedencia.';
    end if;
    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system = v_batch.source_system
      and l.profile_key = v_batch.profile_key
      and l.source_key = v_source_key
    limit 1;$replacement$;
BEGIN
 SELECT pg_catalog.pg_get_functiondef(p.oid)
   INTO v_ddl
 FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private'
   AND p.proname='materialize_pending_legacy_sacramental_records'
   AND pg_catalog.pg_get_function_identity_arguments(p.oid)='p_batch_id uuid, p_limit integer'
 LIMIT 1;
 IF v_ddl IS NULL THEN
   RAISE EXCEPTION 'V213 materializer missing or signature changed; no change applied';
 END IF;
 IF position('Clave histórica vinculada a otra parroquia' in v_ddl)>0 THEN
   -- Already protected: idempotent deployment.
   RETURN;
 END IF;
 IF position(v_old in v_ddl)=0 THEN
   RAISE EXCEPTION 'V213 materializer body changed; inspect manually before patch';
 END IF;
 v_ddl := replace(v_ddl,v_old,v_new);
 EXECUTE v_ddl;
END $migration$;
